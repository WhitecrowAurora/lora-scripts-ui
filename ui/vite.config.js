import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// ── 自动检测 lora-scripts 根目录 ──
// 优先级：环境变量 LORA_SCRIPTS_ROOT > ui 的上级目录（即 ui/ 放在 lora-scripts 内部）> ui 同级的 lora-scripts-*
const uiRoot = path.resolve(__dirname);
const parentDir = path.resolve(uiRoot, '..');

function detectLoraScriptsRoot() {
  if (process.env.LORA_SCRIPTS_ROOT && fs.existsSync(process.env.LORA_SCRIPTS_ROOT)) {
    return path.resolve(process.env.LORA_SCRIPTS_ROOT);
  }
  // ui/ 放在 lora-scripts 训练包内部（推荐部署方式）
  if (fs.existsSync(path.join(parentDir, 'train')) && fs.existsSync(path.join(parentDir, 'sd-models'))) {
    return parentDir;
  }
  // ui/ 与 lora-scripts-* 同级（开发时的目录结构）
  const siblings = fs.readdirSync(path.resolve(parentDir)).filter(
    (d) => d.startsWith('lora-scripts') && fs.statSync(path.join(parentDir, d)).isDirectory()
  );
  if (siblings.length > 0) {
    return path.join(parentDir, siblings[0]);
  }
  // 兜底：假设 ui/ 就在训练包内
  return parentDir;
}

const LORA_ROOT = detectLoraScriptsRoot();
const builtinPickerRoots = {
  folder: path.join(LORA_ROOT, 'train'),
  'output-folder': path.join(LORA_ROOT, 'output'),
  'model-file': path.join(LORA_ROOT, 'sd-models'),
  file: path.join(LORA_ROOT, 'sd-models'),
  'model-saved-file': path.join(LORA_ROOT, 'output'),
};
const SAVED_PARAMS_DIR = path.join(uiRoot, 'saved_params');

function readBuiltinPickerItems(pickerType) {
  const rootPath = builtinPickerRoots[pickerType] || builtinPickerRoots.file;
  const rootLabel = path.relative(LORA_ROOT, rootPath).replaceAll('\\', '/');
  const entries = fs.existsSync(rootPath)
    ? fs.readdirSync(rootPath, { withFileTypes: true })
    : [];

  let items = entries
    .filter((entry) => {
      if (pickerType === 'folder' || pickerType === 'output-folder') {
        return entry.isDirectory();
      }
      return entry.isFile() && entry.name.toLowerCase().endsWith('.safetensors');
    })
    .map((entry) => entry.name)
    .filter((name) => {
      if (name.startsWith('.')) return false;
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return {
    rootLabel,
    items,
  };
}

export default defineConfig({
  root: './',
  base: './', // Use relative paths for assets to support various deployment scenarios
  server: {
    port: 3006,
    open: true,
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:28000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    {
      name: 'builtin-picker-api',
      configureServer(server) {
        // ── Mock API：后端不存在的路由，在开发模式下本地模拟 ──

        // 训练预检（本地验证参数路径是否存在）
        server.middlewares.use('/api/train/preflight', (req, res, next) => {
          if (req.method !== 'POST') { next(); return; }
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const config = JSON.parse(body);
              const errors = [];
              const warnings = [];

              // 检查底模路径
              const modelPath = config.pretrained_model_name_or_path;
              if (modelPath) {
                const absModel = path.resolve(LORA_ROOT, modelPath);
                if (!fs.existsSync(absModel)) {
                  errors.push(`底模文件不存在：${modelPath}`);
                }
              } else {
                errors.push('未指定底模路径');
              }

              // 检查训练数据集路径
              const trainDir = config.train_data_dir;
              if (trainDir) {
                const absTrainDir = path.resolve(LORA_ROOT, trainDir);
                if (!fs.existsSync(absTrainDir)) {
                  errors.push(`训练数据集目录不存在：${trainDir}`);
                } else {
                  const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
                  let hasImages = false;
                  const scan = (dir) => {
                    if (hasImages) return;
                    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                      if (e.isDirectory()) { scan(path.join(dir, e.name)); }
                      else if (imgExts.includes(path.extname(e.name).toLowerCase())) { hasImages = true; return; }
                    }
                  };
                  scan(absTrainDir);
                  if (!hasImages) {
                    errors.push(`训练数据集目录下没有图片文件：${trainDir}`);
                  }
                }
              } else {
                errors.push('未指定训练数据集路径');
              }

              // 检查输出目录
              const outputDir = config.output_dir;
              if (outputDir) {
                const absOutput = path.resolve(LORA_ROOT, outputDir);
                if (!fs.existsSync(absOutput)) {
                  warnings.push(`输出目录不存在（训练时会自动创建）：${outputDir}`);
                }
              }

              const can_start = errors.length === 0;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'success', data: { can_start, errors, warnings } }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'error', message: error.message || '预检失败' }));
            }
          });
        });

        // 显卡信息 mock（后端未启动时的兜底）
        server.middlewares.use('/api/graphic_cards', (req, res, next) => {
          // 尝试转发给后端，如果后端没启动则返回 mock
          next();
        });

        // ── 文件浏览 / 参数管理等本地 API ──

        server.middlewares.use('/api/builtin_picker', (req, res, next) => {
          try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const pickerType = requestUrl.searchParams.get('picker_type') || 'file';
            const data = readBuiltinPickerItems(pickerType);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success', data }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              status: 'error',
              message: error instanceof Error ? error.message : '读取内置文件选择器数据失败。',
            }));
          }
        });

        // 保存参数 API
        server.middlewares.use('/api/saved_configs/save', (req, res, next) => {
          if (req.method !== 'POST') { next(); return; }
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const { name, config } = JSON.parse(body);
              if (!name || !config) throw new Error('缺少参数名称或配置内容。');
              if (!fs.existsSync(SAVED_PARAMS_DIR)) fs.mkdirSync(SAVED_PARAMS_DIR, { recursive: true });
              const safeName = name.replace(/[<>:"/\\|?*]/g, '_').trim();
              const filePath = path.join(SAVED_PARAMS_DIR, `${safeName}.json`);
              fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'success', data: { name: safeName } }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'error', message: error.message || '保存失败。' }));
            }
          });
        });

        // 列出已保存参数 API
        server.middlewares.use('/api/saved_configs/list', (req, res, next) => {
          try {
            if (!fs.existsSync(SAVED_PARAMS_DIR)) fs.mkdirSync(SAVED_PARAMS_DIR, { recursive: true });
            const files = fs.readdirSync(SAVED_PARAMS_DIR)
              .filter((f) => f.endsWith('.json'))
              .map((f) => {
                const stat = fs.statSync(path.join(SAVED_PARAMS_DIR, f));
                return { name: f.replace(/\.json$/, ''), time: stat.mtimeMs };
              })
              .sort((a, b) => b.time - a.time);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success', data: { configs: files } }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'error', message: error.message || '读取列表失败。' }));
          }
        });

        // 读取某个已保存参数 API
        server.middlewares.use('/api/saved_configs/load', (req, res, next) => {
          try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const name = requestUrl.searchParams.get('name');
            if (!name) throw new Error('缺少参数名称。');
            const filePath = path.join(SAVED_PARAMS_DIR, `${name}.json`);
            if (!fs.existsSync(filePath)) throw new Error('参数文件不存在。');
            const content = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success', data: JSON.parse(content) }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'error', message: error.message || '读取失败。' }));
          }
        });

        // 删除已保存参数 API
        server.middlewares.use('/api/saved_configs/delete', (req, res, next) => {
          try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const name = requestUrl.searchParams.get('name');
            if (!name) throw new Error('缺少参数名称。');
            const filePath = path.join(SAVED_PARAMS_DIR, `${name}.json`);
            if (!fs.existsSync(filePath)) throw new Error('参数文件不存在。');
            fs.unlinkSync(filePath);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success' }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'error', message: error.message || '删除失败。' }));
          }
        });

        // 日志目录列表 API
        server.middlewares.use('/api/log_dirs', (req, res, next) => {
          try {
            const logsRoot = path.join(LORA_ROOT, 'logs');
            if (!fs.existsSync(logsRoot)) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'success', data: { dirs: [] } }));
              return;
            }
            const dirs = fs.readdirSync(logsRoot, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => {
                const dirPath = path.join(logsRoot, d.name);
                const stat = fs.statSync(dirPath);
                const events = fs.readdirSync(dirPath).filter((f) => f.startsWith('events.out'));
                return { name: d.name, time: stat.mtimeMs, hasEvents: events.length > 0 };
              })
              .sort((a, b) => b.time - a.time);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success', data: { dirs } }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'error', message: error.message || '读取日志目录失败。' }));
          }
        });

        // 日志目录详情 API
        server.middlewares.use('/api/log_detail', (req, res, next) => {
          try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const dirName = requestUrl.searchParams.get('dir');
            if (!dirName) throw new Error('缺少目录名。');
            const logsRoot = path.join(LORA_ROOT, 'logs');
            const dirPath = path.join(logsRoot, dirName);
            if (!fs.existsSync(dirPath)) throw new Error('日志目录不存在。');
            const files = fs.readdirSync(dirPath).map((f) => {
              const stat = fs.statSync(path.join(dirPath, f));
              return { name: f, size: stat.size, time: stat.mtimeMs };
            });
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success', data: { dir: dirName, files } }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'error', message: error.message || '读取日志详情失败。' }));
          }
        });

        // 数据集标签读取 API
        server.middlewares.use('/api/dataset_tags', (req, res, next) => {
          if (req.method === 'POST') { next(); return; }
          try {
            const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const dirName = requestUrl.searchParams.get('dir');
            if (!dirName) throw new Error('缺少目录名。');
            const trainRoot = path.join(LORA_ROOT, 'train');
            const dirPath = path.join(trainRoot, dirName);
            if (!fs.existsSync(dirPath)) throw new Error('目录不存在。');

            const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
            const results = [];
            const scanDir = (dir) => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) { scanDir(path.join(dir, entry.name)); continue; }
                const ext = path.extname(entry.name).toLowerCase();
                if (!imgExts.includes(ext)) continue;
                const imgPath = path.join(dir, entry.name);
                const txtPath = imgPath.replace(/\.[^.]+$/, '.txt');
                const relPath = path.relative(dirPath, imgPath).replaceAll('\\', '/');
                let tags = '';
                if (fs.existsSync(txtPath)) {
                  tags = fs.readFileSync(txtPath, 'utf-8').trim();
                }
                results.push({ image: relPath, tags });
              }
            };
            scanDir(dirPath);
            results.sort((a, b) => a.image.localeCompare(b.image, 'zh-CN'));
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'success', data: { dir: dirName, items: results } }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'error', message: error.message || '读取数据集标签失败。' }));
          }
        });

        // 保存单个标签 API
        server.middlewares.use('/api/dataset_tags/save', (req, res, next) => {
          if (req.method !== 'POST') { next(); return; }
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const { dir, image, tags } = JSON.parse(body);
              if (!dir || !image) throw new Error('缺少参数。');
              const trainRoot = path.join(LORA_ROOT, 'train');
              const imgPath = path.join(trainRoot, dir, image);
              if (!fs.existsSync(imgPath)) throw new Error('图片文件不存在。');
              const txtPath = imgPath.replace(/\.[^.]+$/, '.txt');
              fs.writeFileSync(txtPath, tags || '', 'utf-8');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'success' }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'error', message: error.message || '保存标签失败。' }));
            }
          });
        });

        // 图像预处理 API
        server.middlewares.use('/api/image_resize', (req, res, next) => {
          if (req.method !== 'POST') { next(); return; }
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const params = JSON.parse(body);
              const { execSync, spawn } = require('child_process');
              const scriptPath = path.join(LORA_ROOT, 'train', '训练图像缩放预处理工具.py');
              if (!fs.existsSync(scriptPath)) throw new Error('预处理脚本不存在。');

              const args = ['--no-gui', '-d', params.input_dir || '.'];
              if (params.output_dir) args.push('-o', params.output_dir);
              if (params.recursive) args.push('-r');
              if (params.format && params.format !== 'ORIGINAL') args.push('-f', params.format);
              if (params.quality) args.push('-q', String(params.quality));
              if (!params.enable_resize) args.push('--no-resize');
              if (params.rename) args.push('--rename');
              if (params.delete_original) args.push('--delete-source');
              if (!params.sync_metadata) args.push('--no-sync');

              // Find python
              const pythonPath = path.join(LORA_ROOT, 'python', 'python.exe');
              const pythonBin = fs.existsSync(pythonPath) ? pythonPath : 'python';

              const child = spawn(pythonBin, [scriptPath, ...args], {
                cwd: LORA_ROOT,
                detached: false,
                stdio: 'ignore',
              });
              child.unref();

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'success', message: '图像预处理已在后台启动。' }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ status: 'error', message: error.message || '启动图像预处理失败。' }));
            }
          });
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
