(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const l of s)if(l.type==="childList")for(const r of l.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function a(s){const l={};return s.integrity&&(l.integrity=s.integrity),s.referrerPolicy&&(l.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?l.credentials="include":s.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function i(s){if(s.ep)return;s.ep=!0;const l=a(s);fetch(s.href,l)}})();const F={en:{nav:{config:"配置",training:"训练",tagger:"标注",dataset:"数据集处理",logs:"日志",tools:"工具",settings:"设置",support:"支持"},navigator:{header:"资源管理器",training_types:"训练类型",preset_list:"参数管理",new_preset:"新建预设",editing:"正在编辑..."},topbar:{model:"模型",tagger:"数据集",dataset:"网络",optimizer:"优化器",advanced:"训练",tensorboard:"预览",tools:"加速",help:"高级"},config:{title:"模型配置",subtitle:"定义基础架构与核心权重重分布参数。",base_model_path:"基础模型路径",precision:"训练精度",save_format:"保存格式",network_rank:"网络秩 (DIM)",network_alpha:"网络 ALPHA",enable_preview:"启用训练预览",enable_preview_desc:"在训练期间实时生成样本图以监控质量。"},actions:{execute:"开始训练",press_f5:""},json_panel:{header:"参数预览"},settings:{title:"系统设置",language:"语言",theme:"主题",dark:"深色",light:"浅色",accent_color:"强调色",reset:"重置"}},zh:{nav:{config:"配置",training:"训练",tagger:"标注",dataset:"数据集处理",logs:"日志",tools:"工具",settings:"设置",support:"支持"},navigator:{header:"资源管理器",training_types:"训练类型",preset_list:"参数管理",new_preset:"新建预设",editing:"正在编辑..."},topbar:{model:"模型",tagger:"数据集",dataset:"网络",optimizer:"优化器",advanced:"训练",tensorboard:"预览",tools:"加速",help:"高级"},config:{title:"模型配置",subtitle:"定义基础架构与核心权重重分布参数。",base_model_path:"基础模型路径",precision:"训练精度",save_format:"保存格式",network_rank:"网络秩 (DIM)",network_alpha:"网络 ALPHA",enable_preview:"启用训练预览",enable_preview_desc:"在训练期间实时生成样本图以监控质量。"},actions:{execute:"开始训练",press_f5:""},json_panel:{header:"参数预览"},settings:{title:"系统设置",language:"语言",theme:"主题",dark:"深色",light:"浅色",accent_color:"强调色",reset:"重置"}}},P=(e,t="zh")=>{const a=e.split(".");let i=F[t]||F.zh;for(const s of a){if(!i||!i[s])return e;i=i[s]}return i},X={"Content-Type":"application/json"};async function v(e,t={}){const a=await fetch(e,{headers:t.body?X:void 0,...t});let i=null;try{i=await a.json()}catch{throw new Error(`接口返回的 JSON 无效：${e}`)}if(!a.ok)throw new Error((i==null?void 0:i.message)||`请求失败：${a.status}`);return i}function w(e,t){return v(e,{method:"POST",body:JSON.stringify(t)})}const f={getGraphicCards(){return v("/api/graphic_cards")},getPresets(){return v("/api/presets")},getSavedParams(){return v("/api/config/saved_params")},getTasks(){return v("/api/tasks")},terminateTask(e){return v(`/api/tasks/terminate/${e}`)},pickFile(e){return v(`/api/pick_file?picker_type=${encodeURIComponent(e)}`)},getBuiltinPicker(e){return v(`/api/builtin_picker?picker_type=${encodeURIComponent(e)}`)},saveConfig(e,t){return w("/api/saved_configs/save",{name:e,config:t})},listSavedConfigs(){return v("/api/saved_configs/list")},loadSavedConfig(e){return v(`/api/saved_configs/load?name=${encodeURIComponent(e)}`)},deleteSavedConfig(e){return v(`/api/saved_configs/delete?name=${encodeURIComponent(e)}`)},runScript(e){return w("/api/run_script",e)},runPreflight(e){return w("/api/train/preflight",e)},previewSamplePrompt(e){return w("/api/train/sample_prompt",e)},getLogDirs(){return v("/api/log_dirs")},getLogDetail(e){return v(`/api/log_detail?dir=${encodeURIComponent(e)}`)},runInterrogate(e){return w("/api/interrogate",e)},getDatasetTags(e){return v(`/api/dataset_tags?dir=${encodeURIComponent(e)}`)},saveDatasetTag(e){return w("/api/dataset_tags/save",e)},runImageResize(e){return w("/api/image_resize",e)},runTraining(e){return w("/api/run",e)}},Y=[{key:"model",label:"模型"},{key:"dataset",label:"数据集"},{key:"network",label:"网络"},{key:"optimizer",label:"优化器"},{key:"training",label:"训练"},{key:"preview",label:"预览/验证"},{key:"speed",label:"加速"},{key:"advanced",label:"高级"}];function m(e,t){return a=>a[e]===t}function Q(...e){return t=>e.every(a=>a(t))}const E=[{id:"model-settings",tab:"model",title:"训练用模型",description:"底模、VAE 与恢复训练相关设置。",fields:[{key:"model_train_type",type:"hidden",defaultValue:"sdxl-lora"},{key:"pretrained_model_name_or_path",type:"file",pickerType:"model-file",label:"底模路径",desc:"SDXL 底模文件路径。",defaultValue:"./sd-models/model.safetensors"},{key:"resume",type:"folder",pickerType:"output-folder",label:"继续训练路径",desc:"从 save_state 状态继续训练（保存在 output 文件夹）。",defaultValue:""},{key:"vae",type:"file",pickerType:"model-file",label:"VAE 路径",desc:"(可选) 外置 VAE 文件路径。",defaultValue:""},{key:"v_parameterization",type:"boolean",label:"V 参数化",desc:"训练 v-pred 模型时需要开启。",defaultValue:!1},{key:"zero_terminal_snr",type:"boolean",label:"零终端 SNR",desc:"v-pred 模型推荐开启。",defaultValue:!0,visibleWhen:m("v_parameterization",!0)},{key:"scale_v_pred_loss_like_noise_pred",type:"boolean",label:"缩放 v-pred 损失",desc:"v-pred 模型推荐开启。",defaultValue:!0,visibleWhen:m("v_parameterization",!0)}]},{id:"save-settings",tab:"model",title:"保存设置",description:"输出路径、格式与训练状态快照。",fields:[{key:"output_name",type:"string",label:"模型保存名称",desc:"输出模型文件名。",defaultValue:"aki"},{key:"output_dir",type:"folder",pickerType:"folder",label:"模型保存文件夹",desc:"输出目录。",defaultValue:"./output"},{key:"save_model_as",type:"select",label:"保存格式",desc:"模型保存格式。",defaultValue:"safetensors",options:["safetensors","pt","ckpt"]},{key:"save_precision",type:"select",label:"保存精度",desc:"模型保存时使用的精度。",defaultValue:"fp16",options:["fp16","float","bf16"]},{key:"save_every_n_epochs",type:"number",label:"每 N 轮保存",desc:"每 N 个 epoch 自动保存一次模型。",defaultValue:2,min:1},{key:"save_every_n_steps",type:"number",label:"每 N 步保存",desc:"每 N 步自动保存一次模型。",defaultValue:"",min:1},{key:"save_state",type:"boolean",label:"保存训练状态",desc:"可用于 resume 继续训练。",defaultValue:!1},{key:"save_state_on_train_end",type:"boolean",label:"结束时额外保存状态",desc:"训练结束时额外保存一次。保存在 output 文件夹。",defaultValue:!1},{key:"save_last_n_epochs_state",type:"number",label:"保留最近 N 个 epoch 状态",desc:"仅保存最近状态。",defaultValue:"",min:1,visibleWhen:m("save_state",!0)}]},{id:"network-settings",tab:"network",title:"网络设置",description:"LoRA / LyCORIS / DyLoRA 相关参数。",fields:[{key:"network_module",type:"select",label:"训练网络模块",desc:"选择当前训练网络。",defaultValue:"networks.lora",options:["networks.lora","networks.dylora","networks.oft","lycoris.kohya"]},{key:"network_weights",type:"file",pickerType:"model-file",label:"继续训练 LoRA",desc:"从已有 LoRA 权重继续训练。",defaultValue:""},{key:"network_dim",type:"slider",label:"网络维度",desc:"常用 4~128。",defaultValue:32,min:1,max:512,step:1},{key:"network_alpha",type:"slider",label:"网络 Alpha",desc:"常用值等于 dim 或其一半。",defaultValue:32,min:1,max:512,step:1},{key:"network_dropout",type:"number",label:"网络 Dropout",desc:"LoRA dropout 概率。",defaultValue:0,min:0,step:.01},{key:"dim_from_weights",type:"boolean",label:"从权重推断 Dim",desc:"自动推断 rank / dim。",defaultValue:!1},{key:"scale_weight_norms",type:"number",label:"最大范数正则化",desc:"使用时推荐为 1。",defaultValue:"",min:0,step:.01},{key:"dora_wd",type:"boolean",label:"启用 DoRA",desc:"启用 DoRA 训练。",defaultValue:!1},{key:"lycoris_algo",type:"select",label:"LyCORIS 算法",desc:"LyCORIS 网络算法。",defaultValue:"locon",options:["locon","loha","lokr","ia3","dylora","glora","diag-oft","boft"],visibleWhen:m("network_module","lycoris.kohya")},{key:"conv_dim",type:"number",label:"卷积维度",desc:"LyCORIS 卷积分支 rank。",defaultValue:4,min:1,visibleWhen:m("network_module","lycoris.kohya")},{key:"conv_alpha",type:"number",label:"卷积 Alpha",desc:"LyCORIS 卷积分支 alpha。",defaultValue:1,min:1,visibleWhen:m("network_module","lycoris.kohya")},{key:"dropout",type:"number",label:"LyCORIS 丢弃率",desc:"推荐 0~0.5。",defaultValue:0,min:0,step:.01,visibleWhen:m("network_module","lycoris.kohya")},{key:"lokr_factor",type:"number",label:"LoKr 系数",desc:"填写 -1 表示无穷。",defaultValue:-1,min:-1,visibleWhen:Q(m("network_module","lycoris.kohya"),m("lycoris_algo","lokr"))},{key:"dylora_unit",type:"number",label:"DyLoRA 分块",desc:"常用 4、8、12、16。",defaultValue:4,min:1,visibleWhen:m("network_module","networks.dylora")},{key:"enable_block_weights",type:"boolean",label:"启用分层学习率",desc:"只支持 networks.lora。",defaultValue:!1},{key:"enable_base_weight",type:"boolean",label:"启用基础权重",desc:"差异炼丹相关。",defaultValue:!1}]},{id:"dataset-settings",tab:"dataset",title:"数据集设置",description:"训练数据、正则图与分桶策略。",fields:[{key:"train_data_dir",type:"folder",pickerType:"folder",label:"训练数据集路径",desc:"包含图片和标注文件的数据集目录。",defaultValue:"./train/aki"},{key:"reg_data_dir",type:"folder",pickerType:"folder",label:"正则化数据集路径",desc:"默认留空，不使用正则化图像。",defaultValue:""},{key:"prior_loss_weight",type:"number",label:"先验损失权重",desc:"正则化图像损失权重。",defaultValue:1,min:0,step:.1},{key:"resolution",type:"string",label:"训练分辨率",desc:"格式为 宽,高，必须是 64 的倍数。",defaultValue:"1024,1024"},{key:"enable_bucket",type:"boolean",label:"启用分桶",desc:"允许不同宽高比图片参与训练。",defaultValue:!0},{key:"min_bucket_reso",type:"number",label:"桶最小分辨率",desc:"arb 桶最小分辨率。",defaultValue:256},{key:"max_bucket_reso",type:"number",label:"桶最大分辨率",desc:"arb 桶最大分辨率。",defaultValue:2048},{key:"bucket_reso_steps",type:"number",label:"桶划分单位",desc:"SDXL 推荐 32。",defaultValue:32},{key:"bucket_no_upscale",type:"boolean",label:"桶不放大图片",desc:"保持原图比例。",defaultValue:!0}]},{id:"caption-settings",tab:"dataset",title:"Caption（Tag）选项",description:"训练时如何读取、打乱与丢弃标签。",fields:[{key:"caption_extension",type:"string",label:"Tag 文件扩展名",desc:"默认是 .txt。",defaultValue:".txt"},{key:"shuffle_caption",type:"boolean",label:"随机打乱标签",desc:"训练时随机打乱 tokens。",defaultValue:!1},{key:"weighted_captions",type:"boolean",label:"使用带权重 token",desc:"不推荐与 shuffle_caption 一起开启。",defaultValue:!1},{key:"keep_tokens",type:"number",label:"保留前 N 个 token",desc:"随机打乱时保留前 N 个不变。",defaultValue:0,min:0,max:255},{key:"max_token_length",type:"number",label:"最大 token 长度",desc:"默认 255。",defaultValue:255,min:1},{key:"caption_dropout_rate",type:"number",label:"全部标签丢弃概率",desc:"对某张图不使用 caption 的概率。",defaultValue:"",min:0,step:.01}]},{id:"optimizer-settings",tab:"optimizer",title:"学习率与优化器设置",description:"学习率、调度器与优化器类型。",fields:[{key:"learning_rate",type:"string",label:"总学习率",desc:"分开设置 U-Net 与文本编码器学习率后会失效。",defaultValue:"1e-4"},{key:"unet_lr",type:"string",label:"U-Net 学习率",desc:"主网络学习率。",defaultValue:"1e-4"},{key:"text_encoder_lr",type:"string",label:"文本编码器学习率",desc:"文本编码器学习率。",defaultValue:"1e-5"},{key:"lr_scheduler",type:"select",label:"学习率调度器",desc:"调度器设置。",defaultValue:"cosine_with_restarts",options:["linear","cosine","cosine_with_restarts","polynomial","constant","constant_with_warmup"]},{key:"lr_warmup_steps",type:"number",label:"预热步数",desc:"学习率预热步数。",defaultValue:0,min:0},{key:"lr_scheduler_num_cycles",type:"number",label:"重启次数",desc:"仅 cosine_with_restarts 时使用。",defaultValue:1,min:1,visibleWhen:m("lr_scheduler","cosine_with_restarts")},{key:"optimizer_type",type:"select",label:"优化器",desc:"当前构建支持的优化器列表。",defaultValue:"AdamW8bit",options:["AdamW","AdamW8bit","PagedAdamW8bit","Lion","Lion8bit","DAdaptation","DAdaptAdam","DAdaptLion","AdaFactor","Prodigy","pytorch_optimizer.CAME"]},{key:"min_snr_gamma",type:"number",label:"Min-SNR Gamma",desc:"如果启用推荐为 5。",defaultValue:"",min:0,step:.1},{key:"prodigy_d0",type:"string",label:"Prodigy d0",desc:"Prodigy 优化器高级参数。",defaultValue:"",visibleWhen:m("optimizer_type","Prodigy")},{key:"prodigy_d_coef",type:"string",label:"Prodigy d_coef",desc:"Prodigy 优化器高级参数。",defaultValue:"2.0",visibleWhen:m("optimizer_type","Prodigy")}]},{id:"training-settings",tab:"training",title:"训练相关参数",description:"基础训练轮数、批量与反向传播设置。",fields:[{key:"max_train_epochs",type:"number",label:"最大训练轮数",desc:"最大训练 epoch 数。",defaultValue:10,min:1},{key:"train_batch_size",type:"slider",label:"批量大小",desc:"越高显存占用越高。",defaultValue:1,min:1,max:32,step:1},{key:"gradient_checkpointing",type:"boolean",label:"梯度检查点",desc:"降低显存占用。",defaultValue:!0},{key:"gradient_accumulation_steps",type:"number",label:"梯度累加步数",desc:"模拟更大 batch。",defaultValue:1,min:1},{key:"network_train_unet_only",type:"boolean",label:"仅训练 U-Net",desc:"基础 SDXL LoRA 推荐开启。",defaultValue:!0},{key:"network_train_text_encoder_only",type:"boolean",label:"仅训练文本编码器",desc:"只训练文本编码器。",defaultValue:!1}]},{id:"preview-settings",tab:"preview",title:"训练预览图设置",description:"训练中生成预览图的配置。",fields:[{key:"enable_preview",type:"boolean",label:"启用预览图",desc:"训练期间自动生成预览图。",defaultValue:!1},{key:"randomly_choice_prompt",type:"boolean",label:"随机选择提示词",desc:"从数据集标注里随机抽取提示词。",defaultValue:!1,visibleWhen:m("enable_preview",!0)},{key:"prompt_file",type:"file",pickerType:"text-file",label:"提示词文件路径",desc:"填写后优先使用文件中的提示词。",defaultValue:"",visibleWhen:m("enable_preview",!0)},{key:"positive_prompts",type:"textarea",label:"正向提示词",desc:"正向提示词。",defaultValue:"masterpiece, best quality, 1girl, solo",visibleWhen:m("enable_preview",!0)},{key:"negative_prompts",type:"textarea",label:"反向提示词",desc:"反向提示词。",defaultValue:"lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts,signature, watermark, username, blurry",visibleWhen:m("enable_preview",!0)},{key:"sample_width",type:"number",label:"预览图宽度",desc:"预览图宽度。",defaultValue:512,min:64,visibleWhen:m("enable_preview",!0)},{key:"sample_height",type:"number",label:"预览图高度",desc:"预览图高度。",defaultValue:512,min:64,visibleWhen:m("enable_preview",!0)},{key:"sample_cfg",type:"number",label:"CFG 系数",desc:"预览图 CFG。",defaultValue:7,min:1,max:30,visibleWhen:m("enable_preview",!0)},{key:"sample_steps",type:"number",label:"采样步数",desc:"预览图迭代步数。",defaultValue:24,min:1,max:300,visibleWhen:m("enable_preview",!0)},{key:"sample_sampler",type:"select",label:"采样器",desc:"生成预览图所用采样器。",defaultValue:"euler_a",options:["ddim","pndm","lms","euler","euler_a","heun","dpm_2","dpm_2_a","dpmsolver","dpmsolver++"],visibleWhen:m("enable_preview",!0)},{key:"validation_split",type:"number",label:"验证集划分比例",desc:"会从训练集中自动切出一部分做验证。",defaultValue:0,min:0,max:1,step:.01},{key:"log_with",type:"select",label:"日志模块",desc:"选择 tensorboard 或 wandb。",defaultValue:"tensorboard",options:["tensorboard","wandb"]},{key:"logging_dir",type:"folder",pickerType:"folder",label:"日志保存文件夹",desc:"日志输出目录。",defaultValue:"./logs"}]},{id:"speed-settings",tab:"speed",title:"速度优化选项",description:"混合精度、缓存与注意力后端。",fields:[{key:"mixed_precision",type:"select",label:"混合精度",desc:"RTX30 及以后也可以指定 bf16。",defaultValue:"bf16",options:["no","fp16","bf16"]},{key:"xformers",type:"boolean",label:"启用 xformers",desc:"启用 xformers 加速。",defaultValue:!0},{key:"sageattn",type:"boolean",label:"启用 SageAttention",desc:"实验性功能，需要 SageAttention 环境。",defaultValue:!1},{key:"sdpa",type:"boolean",label:"启用 SDPA",desc:"启用 SDPA 注意力。",defaultValue:!0},{key:"mem_eff_attn",type:"boolean",label:"低显存注意力",desc:"更兼容，但通常更慢。",defaultValue:!1},{key:"lowram",type:"boolean",label:"低内存模式",desc:"直接把主要模块加载到显存。",defaultValue:!1},{key:"cache_latents",type:"boolean",label:"缓存 Latent",desc:"缓存图像 latent。",defaultValue:!0},{key:"cache_latents_to_disk",type:"boolean",label:"缓存 Latent 到磁盘",desc:"把 latent 写入磁盘。",defaultValue:!0},{key:"cache_text_encoder_outputs",type:"boolean",label:"缓存文本编码器输出",desc:"需要关闭 shuffle_caption。",defaultValue:!0},{key:"cache_text_encoder_outputs_to_disk",type:"boolean",label:"缓存文本编码器输出到磁盘",desc:"把文本编码器输出写入磁盘。",defaultValue:!1}]},{id:"advanced-settings",tab:"advanced",title:"其他设置",description:"噪声、随机种子与实验功能。",fields:[{key:"noise_offset",type:"number",label:"噪声偏移",desc:"改善非常暗或非常亮图像的生成。",defaultValue:"",step:.01},{key:"seed",type:"number",label:"随机种子",desc:"默认 1337。",defaultValue:1337},{key:"clip_skip",type:"slider",label:"CLIP 跳层",desc:"当前构建中 SDXL clip_skip 仍属实验。",defaultValue:2,min:0,max:12,step:1},{key:"masked_loss",type:"boolean",label:"启用蒙版损失",desc:"训练带透明蒙版 / alpha 图像时可用。",defaultValue:!1},{key:"alpha_mask",type:"boolean",label:"读取 Alpha 通道作为 Mask",desc:"透明背景 / 抠图训练时通常要一起开启。",defaultValue:!1},{key:"training_comment",type:"textarea",label:"训练备注",desc:"写入模型元数据的备注。",defaultValue:""},{key:"ui_custom_params",type:"textarea",label:"自定义 TOML 覆盖",desc:"危险：会直接覆盖界面中的参数。",defaultValue:""},{key:"ddp_timeout",type:"number",label:"DDP 超时时间",desc:"分布式训练超时时间。",defaultValue:"",min:0}]}],U=new Map;for(const e of E)for(const t of e.fields)U.set(t.key,t);function V(e){return U.get(e)}function Z(e){return E.filter(t=>t.tab===e)}function N(e,t){return e!=null&&e.visibleWhen?e.visibleWhen(t):!0}function G(){const e={};for(const t of E)for(const a of t.fields)Array.isArray(a.defaultValue)?e[a.key]=[...a.defaultValue]:e[a.key]=a.defaultValue??"";return e}function R(e,t){if(!e)return t;if(e.type==="boolean")return!!t;if(e.type==="number"||e.type==="slider"){if(t===""||t===null||t===void 0)return"";const a=Number(t);return Number.isNaN(a)?"":a}return t}function L(e){const t={};for(const a of E)for(const i of a.fields){if(i.type!=="hidden"&&!N(i,e))continue;const s=e[i.key];if(i.type==="boolean"){t[i.key]=!!s;continue}if(i.type==="number"||i.type==="slider"){if(s===""||s===null||s===void 0)continue;const l=Number(s);Number.isNaN(l)||(t[i.key]=l);continue}s===""||s===null||s===void 0||(t[i.key]=s)}return t.model_train_type="sdxl-lora",t}const o=e=>document.querySelector(e),x=e=>document.querySelectorAll(e),ee=Y.map(e=>e.key),q=new Set(["v_parameterization","save_state","network_module","lycoris_algo","lr_scheduler","optimizer_type","enable_preview","randomly_choice_prompt"]),z="sd-rescripts:ui:sdxl-draft",n={compactLayout:!1,importInputBound:!1,pickerInputBound:!1,navigatorWidth:Number(localStorage.getItem("sd-rescripts:ui:navigator-width")||240),jsonPanelWidth:Number(localStorage.getItem("sd-rescripts:ui:json-width")||280),fieldUndo:{},activeFieldMenu:null,datasetSubTab:"tagger",builtinPicker:{open:!1,fieldKey:"",pickerType:"",rootLabel:"",items:[]},layoutDefaults:{compactLayout:!1,navigatorWidth:240,jsonPanelWidth:280},jsonPanelCollapsed:!1,lang:"zh",theme:localStorage.getItem("theme")||"dark",activeModule:"config",activeTab:localStorage.getItem("sdxl_ui_tab")||"model",navigatorCollapsed:!1,sections:{"training-types":!0,"preset-list":!0},accentColor:localStorage.getItem("accentColor")||null,config:G(),hasLocalDraft:!1,presets:[],tasks:[],runtime:null,preflight:null,samplePrompt:null,runtimeError:"",lastMessage:"",loading:{runtime:!1,preflight:!1,samplePrompt:!1,run:!1}};function te(){ae(),O(),ye(),be(),ge(),me(),C(),Ve(),Se(),Pe(),fe(),y(n.activeModule),ie(),se()}function d(e){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function p(e,t=2500){let a=o("#toast-container");a||(a=document.createElement("div"),a.id="toast-container",document.body.appendChild(a));const i=document.createElement("div");i.className="toast-item",i.textContent=e,a.appendChild(i),requestAnimationFrame(()=>i.classList.add("show")),setTimeout(()=>{i.classList.remove("show"),i.addEventListener("transitionend",()=>i.remove(),{once:!0}),setTimeout(()=>i.remove(),400)},t)}function ae(){const e=localStorage.getItem(z);if(e)try{const t=JSON.parse(e);if(!t||typeof t!="object")return;S(t),n.hasLocalDraft=!0}catch(t){console.warn("Failed to read local draft:",t)}}function $(){localStorage.setItem(z,JSON.stringify(n.config))}function S(e){if(!(!e||typeof e!="object"))for(const[t,a]of Object.entries(e)){const i=V(t);i&&(n.config[t]=R(i,a))}}function ne(e){return e?e.pickerType==="model-file"||e.pickerType==="output-folder"?!0:["train_data_dir","reg_data_dir","resume"].includes(e.key):!1}async function ie(){var s,l,r,c,u;n.loading.runtime=!0,_();const[e,t,a,i]=await Promise.allSettled([f.getGraphicCards(),f.getPresets(),f.getSavedParams(),f.getTasks()]);e.status==="fulfilled"?(n.runtime=e.value.data||null,n.runtimeError=""):n.runtimeError=((s=e.reason)==null?void 0:s.message)||"运行环境状态不可用。",t.status==="fulfilled"&&(n.presets=((r=(l=t.value)==null?void 0:l.data)==null?void 0:r.presets)||[]),a.status==="fulfilled"&&!n.hasLocalDraft&&(S(a.value.data||{}),$()),i.status==="fulfilled"&&(n.tasks=((u=(c=i.value)==null?void 0:c.data)==null?void 0:u.tasks)||[]),n.loading.runtime=!1,n.activeModule==="config"?y("config"):_()}function se(){window.sttInterval(async()=>{var e;try{const t=await f.getTasks();n.tasks=((e=t==null?void 0:t.data)==null?void 0:e.tasks)||[],_(),pe()}catch(t){console.warn("Task polling failed:",t)}},3e3)}function y(e){const t=o(".content-area");if(t){if(C(),e==="config"){le(t);return}if(e==="settings"){he(t);return}if(e==="logs"){$e(t);return}if(e==="tools"){Te(t);return}if(e==="dataset"){ke(t);return}t.innerHTML=`
    <div class="form-container">
      <header class="section-title">
        <h2>${d(e.toUpperCase())}</h2>
        <p>这个模块暂未接入真实功能，目前先集中完善 SDXL 训练页。</p>
      </header>
      <div class="empty-state">
        <strong>开发中</strong>
        <span>当前原型保留了导航结构，但主要开发集中在 SDXL LoRA 参数页。</span>
      </div>
    </div>
  `}}function le(e){const a=Z(n.activeTab).filter(i=>i.fields.some(s=>s.type!=="hidden"&&N(s,n.config)));e.innerHTML=`
    <div class="form-container">
      <header class="section-title">
        <h2>SDXL LoRA 模式</h2>
        <p></p>
      </header>
      <div class="status-deck" id="status-deck">${ue()}</div>
      <div class="section-toolbar">
        <div class="toolbar-actions toolbar-check-actions">
          <button class="btn btn-outline btn-check" type="button" onclick="runPreflight()">
            <span class="btn-check-label">训练预检</span>
            <span class="btn-check-desc">检查数据集路径、底模路径等参数是否可用</span>
          </button>
          <button class="btn btn-outline btn-check" type="button" onclick="runSelfCheck()">
            <span class="btn-check-label">环境自检</span>
            <span class="btn-check-desc">检测 GPU、Torch、依赖库等运行环境</span>
          </button>
        </div>
      </div>
      ${a.map(oe).join("")}
    </div>
  `,j(),A(),W(),_()}function oe(e){const t=e.fields.filter(a=>a.type!=="hidden"&&N(a,n.config));return`
    <section class="form-section" id="${d(e.id)}">
      <header class="section-header">
        <h3>${d(e.title)}</h3>
        <span class="section-meta">${t.length} 项参数</span>
      </header>
      <div class="section-summary">${d(e.description)}</div>
      <div class="section-content">
        ${t.map(a=>re(a)).join("")}
      </div>
    </section>
  `}function re(e){const t=n.config[e.key],a=e.label;e.defaultValue;const i=e.type==="file"||e.type==="folder",s=ne(e);Object.hasOwn(n.fieldUndo,e.key);const l=e.pickerType||e.type,r=l==="folder"||l==="output-folder"?"#icon-folder":"#icon-file",c=()=>`
    <div class="field-header-row">
      <label>${d(a)}</label>
      <div class="field-inline-actions" data-field-key="${e.key}">
        <button class="field-menu-toggle" type="button" title="参数更多操作" data-field-menu-key="${e.key}">···</button>
        ${s?`<button class="picker-mode-icon-btn" type="button" title="内置文件选择器" onclick="openNativePicker('${e.key}', '${l}')"><svg class="icon"><use href="${r}"></use></svg></button>`:""}
      </div>
    </div>
  `;if(e.type==="boolean")return`
      <div class="config-group row boolean-card">
        <div class="label-col">
          ${c()}
          <p class="field-desc">${d(e.desc||"")}</p>
        </div>
        <label class="switch switch-compact">
          <input type="checkbox" ${t?"checked":""} onchange="updateConfigValue('${e.key}', this.checked)">
          <span class="slider round"></span>
        </label>
      </div>
    `;if(e.type==="select")return`
      <div class="config-group">
        ${c()}
        <p class="field-desc">${d(e.desc||"")}</p>
        <select onchange="updateConfigValue('${e.key}', this.value)">
          ${e.options.map(g=>`<option value="${d(g)}" ${String(t)===String(g)?"selected":""}>${d(g||"默认")}</option>`).join("")}
        </select>
      </div>
    `;if(e.type==="textarea")return`
      <div class="config-group">
        ${c()}
        <p class="field-desc">${d(e.desc||"")}</p>
        <textarea class="text-area" oninput="updateConfigValue('${e.key}', this.value)">${d(t||"")}</textarea>
      </div>
    `;const u=e.type==="number"||e.type==="slider"?"number":"text",b=t??"";return i?`
      <div class="config-group">
        ${c()}
        <p class="field-desc">${d(e.desc||"")}</p>
        <div class="input-picker">
          <button class="picker-icon" type="button" onclick="pickPath('${e.key}', '${e.pickerType||"folder"}')">
            <svg class="icon"><use href="#icon-folder"></use></svg>
          </button>
          <input type="text" value="${d(b)}" oninput="updateConfigValue('${e.key}', this.value)">
        </div>
      </div>
    `:`
    <div class="config-group">
      ${c()}
      <p class="field-desc">${d(e.desc||"")}</p>
      <input class="text-input" type="${u}" value="${d(b)}" ${e.min!==void 0?`min="${e.min}"`:""} ${e.max!==void 0?`max="${e.max}"`:""} ${e.step!==void 0?`step="${e.step}"`:""} oninput="updateConfigValue('${e.key}', this.value)">
    </div>
  `}function ce(){var e,t;return n.runtimeError?n.runtimeError:(t=(e=n.runtime)==null?void 0:e.cards)!=null&&t.length?n.runtime.cards.map(a=>typeof a=="string"?a:a.name||JSON.stringify(a)).join("，"):"等待检测显卡信息"}function de(){if(!n.preflight)return"在训练前建议运行一遍训练预检";if(n.preflight.can_start){const t=n.preflight.warnings||[];return t.length?`${t.length} 个警告：${t[0]}`:"全部通过，可以启动训练"}const e=n.preflight.errors||[];return e.length?e.map((t,a)=>`[${a+1}] ${t}`).join("；"):"训练预检未通过"}function ue(){var s,l,r,c,u,b;const e=n.runtimeError?"离线":n.loading.runtime?"检测中...":(l=(s=n.runtime)==null?void 0:s.cards)!=null&&l.length?`${n.runtime.cards.length} 张显卡`:"检测中",t=(c=(r=n.runtime)==null?void 0:r.xformers)!=null&&c.installed?`${n.runtime.xformers.version||"已安装"}`:"未安装",a=n.preflight?n.preflight.can_start?"可以启动":`${n.preflight.errors.length} 个错误`:"未检查",i=n.tasks.filter(g=>g.status==="RUNNING").length;return`
    <div class="status-card">
      <span class="status-label">运行环境</span>
      <strong class="status-value">${d(e)}</strong>
      <span class="status-sub">${d(ce())}</span>
    </div>
    <div class="status-card">
      <span class="status-label">xFormers</span>
      <strong class="status-value">${d(t)}</strong>
      <span class="status-sub">${d(((b=(u=n.runtime)==null?void 0:u.xformers)==null?void 0:b.reason)||"暂无状态信息")}</span>
    </div>
    <div class="status-card">
      <span class="status-label">训练预检</span>
      <strong class="status-value">${d(a)}</strong>
      <span class="status-sub">${d(de())}</span>
    </div>
    <div class="status-card" id="task-status-card">
      <span class="status-label">任务</span>
      <strong class="status-value">${i}</strong>
      <span class="status-sub">${i>0?`有 ${i} 个任务运行中`:"空闲"}</span>
    </div>
  `}function j(){const e=o("#section-training-types .group-list");e&&(e.innerHTML=`
      <li class="active">SDXL</li>
      <li class="disabled">SD1.5</li>
      <li class="disabled">FLUX</li>
      <li class="disabled">SD3.5</li>
    `);const t=o("#section-preset-list .section-content");t&&(t.innerHTML=`
      <div class="preset-actions-grid">
        <button class="btn btn-outline btn-sm" type="button" onclick="resetAllParams()">重置所有参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="saveCurrentParams()">保存参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="loadSavedParams()">读取参数</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="downloadConfigFile()">导出配置文件</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="importConfigFile()">导入配置文件</button>
      </div>
    `)}function C(){const e=n.activeModule==="config";document.body.classList.toggle("show-config-chrome",e),document.documentElement.style.setProperty("--navigator-width",`${n.navigatorWidth}px`),document.documentElement.style.setProperty("--json-panel-width",`${n.jsonPanelWidth}px`);const t=o("#navigator"),a=o("#navigator-expand-btn");e||(t==null||t.classList.remove("collapsed"),a&&(a.style.display="none"))}function J(){localStorage.setItem("sd-rescripts:ui:navigator-width",String(n.navigatorWidth)),localStorage.setItem("sd-rescripts:ui:json-width",String(n.jsonPanelWidth)),C()}function I(){n.preflight=null,n.samplePrompt=null,n.lastMessage=""}function D(){$(),_()}function W(){const e=o(".bottom-bar");if(!e)return;const t=n.tasks.some(a=>a.status==="RUNNING");e.innerHTML=`
    <button class="btn btn-primary btn-execute" onclick="executeTraining()" ${n.loading.run?"disabled":""}>
      <span class="btn-main">${n.loading.run?"正在启动训练...":"开始训练"}</span>
    </button>
    ${t?`
      <button class="btn btn-danger btn-terminate" onclick="terminateAllTasks()">
        <span class="btn-main">终止训练</span>
      </button>
    `:""}
  `}function A(){n.activeFieldMenu&&(n.activeFieldMenu=null),C(),x(".top-nav-item").forEach(e=>{e.classList.toggle("active",e.dataset.tab===n.activeTab)})}function pe(){const e=o("#task-status-card .status-value"),t=o("#task-status-card .status-sub");if(!e||!t)return;const a=n.tasks.filter(i=>i.status==="RUNNING");e.textContent=String(a.length),t.textContent=a.length>0?`有 ${a.length} 个任务运行中`:"空闲"}function fe(){const e=o(".json-panel"),t=o("#json-panel-toggle"),a=o("#json-panel-toggle use");if(!e||!t||!a)return;const i=()=>{e.classList.toggle("collapsed",n.jsonPanelCollapsed),t.title=n.jsonPanelCollapsed?"展开参数预览":"收起参数预览",a.setAttribute("href",n.jsonPanelCollapsed?"#icon-chevron-left":"#icon-chevron-right")};t.addEventListener("click",()=>{n.jsonPanelCollapsed=!n.jsonPanelCollapsed,i()}),i()}function be(){var e;x(".nav-item").forEach(t=>{t.addEventListener("click",a=>{a.preventDefault();const i=t.dataset.module;i&&(x(".nav-item").forEach(s=>s.classList.remove("active")),t.classList.add("active"),n.activeModule=i,y(i))})}),(e=o("#theme-toggle"))==null||e.addEventListener("click",ve)}function ge(){x(".top-nav-item").forEach((e,t)=>{const a=ee[t];if(!a){e.style.display="none";return}e.dataset.tab=a,e.addEventListener("click",i=>{i.preventDefault(),n.activeTab=a,localStorage.setItem("sdxl_ui_tab",a),n.activeModule==="config"?y("config"):A()})}),A()}function me(){const e=o("#navigator"),t=o("#navigator-collapse-btn"),a=o("#navigator-expand-btn"),i=()=>{n.activeModule==="config"&&(e==null||e.classList.toggle("collapsed",n.navigatorCollapsed),a&&(a.style.display=n.navigatorCollapsed?"flex":"none"))};t==null||t.addEventListener("click",()=>{n.navigatorCollapsed=!0,i()}),a==null||a.addEventListener("click",()=>{n.navigatorCollapsed=!1,i()}),i(),x(".nav-section .section-header").forEach(s=>{s.addEventListener("click",()=>{const l=s.closest(".nav-section");if(!l)return;const r=l.id.replace("section-","");n.sections[r]=!n.sections[r],l.classList.toggle("collapsed",!n.sections[r])})})}function _(){const e=o("#json-viewer code");if(!e)return;const t=L(n.config);e.textContent=JSON.stringify(t,null,2)}function ye(){x("[data-i18n]").forEach(e=>{const t=e.dataset.i18n;e.textContent=P(t,n.lang)})}function O(){document.documentElement.classList.toggle("light-theme",n.theme==="light");const e=o(".moon-icon"),t=o(".sun-icon");e&&t&&(e.style.display=n.theme==="dark"?"block":"none",t.style.display=n.theme==="light"?"block":"none")}function ve(){n.theme=n.theme==="dark"?"light":"dark",localStorage.setItem("theme",n.theme),O()}function he(e){var t,a,i,s,l,r;e.innerHTML=`
    <div class="form-container">
      <header class="section-title">
        <h2>${P("settings.title",n.lang)}</h2>
        <p>这里统一控制界面布局，适配不同分辨率。点击重置即可恢复默认布局。</p>
      </header>
      <div class="settings-row">
        <label>${P("settings.theme",n.lang)}</label>
        <select id="theme-select">
          <option value="dark" ${n.theme==="dark"?"selected":""}>${P("settings.dark",n.lang)}</option>
          <option value="light" ${n.theme==="light"?"selected":""}>${P("settings.light",n.lang)}</option>
        </select>
      </div>
      <div class="settings-row settings-slider-row">
        <label>左侧资源管理器宽度</label>
        <div class="settings-slider-control">
          <input type="range" id="navigator-width-slider" min="180" max="420" step="10" value="${n.navigatorWidth}">
          <strong id="navigator-width-value">${n.navigatorWidth}px</strong>
        </div>
      </div>
      <div class="settings-row settings-slider-row">
        <label>右侧参数预览宽度</label>
        <div class="settings-slider-control">
          <input type="range" id="json-width-slider" min="220" max="460" step="10" value="${n.jsonPanelWidth}">
          <strong id="json-width-value">${n.jsonPanelWidth}px</strong>
        </div>
      </div>
      <div class="settings-row">
        <label>布局重置</label>
        <button class="btn btn-outline btn-sm" type="button" id="reset-layout-btn">恢复默认</button>
      </div>
    </div>
  `,(t=o("#theme-select"))==null||t.addEventListener("change",c=>{n.theme=c.target.value,localStorage.setItem("theme",n.theme),O()}),(a=o("#navigator-width-slider"))==null||a.addEventListener("input",c=>updateLayoutWidth("navigator",c.target.value,!1)),(i=o("#navigator-width-slider"))==null||i.addEventListener("change",c=>updateLayoutWidth("navigator",c.target.value,!0)),(s=o("#json-width-slider"))==null||s.addEventListener("input",c=>updateLayoutWidth("json",c.target.value,!1)),(l=o("#json-width-slider"))==null||l.addEventListener("change",c=>updateLayoutWidth("json",c.target.value,!0)),(r=o("#reset-layout-btn"))==null||r.addEventListener("click",()=>{n.navigatorWidth=n.layoutDefaults.navigatorWidth,n.jsonPanelWidth=n.layoutDefaults.jsonPanelWidth,J(),y("settings")})}function ke(e){const t=n.datasetSubTab||"tagger";e.innerHTML=`
    <div class="form-container">
      <header class="section-title">
        <h2>数据集处理</h2>
        <p>图片标注、标签编辑与图像预处理。</p>
      </header>
      <div class="dataset-tabs">
        <button class="dataset-tab ${t==="tagger"?"active":""}" type="button" onclick="switchDatasetTab('tagger')">标签器</button>
        <button class="dataset-tab ${t==="editor"?"active":""}" type="button" onclick="switchDatasetTab('editor')">标签编辑器</button>
        <button class="dataset-tab ${t==="resize"?"active":""}" type="button" onclick="switchDatasetTab('resize')">图像预处理</button>
      </div>
      <div id="dataset-content"></div>
    </div>
  `,t==="tagger"?_e():t==="editor"?we():Le()}window.switchDatasetTab=e=>{n.datasetSubTab=e,n.activeModule==="dataset"&&y("dataset")};function _e(){const e=o("#dataset-content");if(!e)return;const t=["wd14-convnextv2-v2","wd-convnext-v3","wd-swinv2-v3","wd-vit-v3","wd14-swinv2-v2","wd14-vit-v2","wd14-moat-v2","wd-eva02-large-tagger-v3","wd-vit-large-tagger-v3","cl-tagger-1.00","cl-tagger-1.01","cl-tagger-1.02"],a=["ignore","copy","prepend","append"],i={ignore:"跳过已有",copy:"覆盖",prepend:"前置追加",append:"后置追加"};e.innerHTML=`
    <section class="form-section">
      <header class="section-header"><h3>WD14 / CL 标签器</h3></header>
      <div class="section-summary">对训练数据集进行自动标注，为每张图片生成 .txt 标签文件。</div>
      <div class="section-content tool-fields">
        <div class="config-group">
          <label>数据集路径</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="openNativePicker('tagger-path', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="tagger-path" placeholder="./train/your_dataset">
          </div>
        </div>
        <div class="config-group">
          <label>标注模型</label>
          <select id="tagger-model">
            ${t.map(s=>`<option value="${s}" ${s==="wd14-convnextv2-v2"?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="config-group">
          <label>置信度阈值</label>
          <input class="text-input" type="number" id="tagger-threshold" value="0.35" min="0" max="1" step="0.01">
        </div>
        <div class="config-group">
          <label>冲突处理</label>
          <select id="tagger-conflict">
            ${a.map(s=>`<option value="${s}" ${s==="ignore"?"selected":""}>${i[s]}</option>`).join("")}
          </select>
        </div>
        <div class="config-group">
          <label>额外追加标签</label>
          <input class="text-input" type="text" id="tagger-additional" placeholder="tag1, tag2">
        </div>
        <div class="config-group">
          <label>排除标签</label>
          <input class="text-input" type="text" id="tagger-exclude" placeholder="tag_to_remove">
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col">
            <label>递归扫描子目录</label>
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" id="tagger-recursive">
            <span class="slider round"></span>
          </label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col">
            <label>替换下划线为空格</label>
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" id="tagger-underscore" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col">
            <label>转义括号</label>
          </div>
          <label class="switch switch-compact">
            <input type="checkbox" id="tagger-escape" checked>
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="tool-actions">
        <button class="btn btn-primary btn-sm" type="button" onclick="runTagger()">开始标注</button>
      </div>
    </section>
  `}window.runTagger=async()=>{var a,i,s,l,r,c,u,b,g,k;const e=(i=(a=o("#tagger-path"))==null?void 0:a.value)==null?void 0:i.trim();if(!e){p("请先填写数据集路径。");return}const t={path:e,interrogator_model:((s=o("#tagger-model"))==null?void 0:s.value)||"wd14-convnextv2-v2",threshold:parseFloat((l=o("#tagger-threshold"))==null?void 0:l.value)||.35,additional_tags:((r=o("#tagger-additional"))==null?void 0:r.value)||"",exclude_tags:((c=o("#tagger-exclude"))==null?void 0:c.value)||"",batch_input_recursive:((u=o("#tagger-recursive"))==null?void 0:u.checked)||!1,batch_output_action_on_conflict:((b=o("#tagger-conflict"))==null?void 0:b.value)||"ignore",replace_underscore:((g=o("#tagger-underscore"))==null?void 0:g.checked)??!0,escape_tag:((k=o("#tagger-escape"))==null?void 0:k.checked)??!0};try{await f.runInterrogate(t),p("标注任务已提交，正在后台运行...")}catch(h){p(h.message||"标注任务启动失败。")}};function we(){const e=o("#dataset-content");e&&(e.innerHTML=`
    <section class="form-section">
      <header class="section-header"><h3>标签编辑器</h3></header>
      <div class="section-summary">推荐使用外部标签编辑器工具，可以获得更完整的批量编辑体验。</div>
      <div class="empty-state" style="margin-top:16px;">
        <strong>请使用外部工具</strong>
        <span>训练包内附带 <code>1BooruDatasetTagManager</code>，双击 <code>BooruDatasetTagManager.exe</code> 即可启动。<br>支持批量查看、编辑、搜索替换标签，比内置编辑器更高效。</span>
        <button class="btn btn-outline btn-sm" type="button" style="margin-top:12px;" onclick="openExternalTagEditor()">了解更多</button>
      </div>
    </section>
  `)}window.openExternalTagEditor=()=>{p("请在训练包目录下找到 1BooruDatasetTagManager 文件夹并双击 exe 启动。")};function Le(){const e=o("#dataset-content");if(!e)return;const t=[[768,1344],[832,1216],[896,1152],[1024,1024],[1152,896],[1216,832],[1344,768]];e.innerHTML=`
    <section class="form-section">
      <header class="section-header"><h3>训练图像缩放预处理</h3></header>
      <div class="section-summary">将图片缩放到最接近的预设目标分辨率，保持宽高比。支持批量转换格式、自动重命名、同步描述文件。<br><strong>推荐常用参数：智能缩放 + 精确裁剪</strong></div>
      <div class="section-content tool-fields">
        <div class="config-group" style="grid-column:1/-1;">
          <label>输入目录</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <select id="resize-input-select" style="flex:1;"><option value="">加载中...</option></select>
            <button class="picker-mode-icon-btn" type="button" title="内置文件选择器" onclick="openNativePicker('resize-input-select', 'folder')"><svg class="icon"><use href="#icon-folder"></use></svg></button>
          </div>
          <p class="field-desc">选择 train 目录下的数据集文件夹。</p>
        </div>
        <div class="config-group" style="grid-column:1/-1;">
          <label>输出目录（留空则覆盖原文件）</label>
          <div class="input-picker">
            <button class="picker-icon" type="button" onclick="openNativePicker('resize-output', 'folder')">
              <svg class="icon"><use href="#icon-folder"></use></svg>
            </button>
            <input class="text-input" type="text" id="resize-output" placeholder="留空则在原目录生成">
          </div>
        </div>
        <div class="config-group">
          <label>输出格式</label>
          <select id="resize-format">
            <option value="ORIGINAL">原格式</option>
            <option value="JPEG">JPEG (.jpg)</option>
            <option value="WEBP">WEBP (.webp)</option>
            <option value="PNG">PNG (.png)</option>
          </select>
        </div>
        <div class="config-group">
          <label>质量 (JPG/WEBP)：<span id="resize-quality-val">95</span>%</label>
          <input type="range" id="resize-quality" value="95" min="1" max="100" step="1" oninput="document.getElementById('resize-quality-val').textContent=this.value">
        </div>
        <div class="config-group" style="grid-column:1/-1;">
          <label>目标分辨率列表</label>
          <input class="text-input" type="text" id="resize-resolutions" value="${t.map(a=>a.join("x")).join(", ")}" placeholder="768x1344, 1024x1024, ...">
          <p class="field-desc">格式：宽x高，逗号分隔。图片会匹配宽高比最接近的分辨率。</p>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>启用智能缩放</label><p class="field-desc">禁用后仅转换格式，不改变尺寸。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-enable" checked><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>精确裁剪到目标尺寸</label><p class="field-desc">缩放后居中裁剪，输出精确等于目标尺寸。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-exact"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>递归处理子目录</label><p class="field-desc">扫描并处理所有子文件夹中的图片。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-recursive"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>自动重命名 (文件夹名_序号)</label><p class="field-desc">输出文件命名为 父文件夹名_1、父文件夹名_2 ...</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-rename"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>处理后删除原图</label><p class="field-desc">处理成功后删除源文件，建议配合输出目录使用。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-delete"><span class="slider round"></span></label>
        </div>
        <div class="config-group row boolean-card">
          <div class="label-col"><label>同步处理描述文件</label><p class="field-desc">自动同步 .txt / .npz / .caption 文件。</p></div>
          <label class="switch switch-compact"><input type="checkbox" id="resize-sync" checked><span class="slider round"></span></label>
        </div>
      </div>
      <div class="tool-actions" style="display:flex;gap:8px;">
        <button class="btn btn-primary btn-sm" type="button" onclick="runImageResize()">开始处理</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="openResizeGui()">打开图形界面</button>
      </div>
    </section>
  `,xe()}async function xe(){var t;const e=o("#resize-input-select");if(e)try{const a=await f.getBuiltinPicker("folder"),i=((t=a==null?void 0:a.data)==null?void 0:t.items)||[];if(!i.length){e.innerHTML='<option value="">未检测到数据集目录</option>';return}e.innerHTML=i.map(s=>`<option value="./train/${d(s)}">${d(s)}</option>`).join("")}catch{e.innerHTML='<option value="">读取失败</option>'}}window.runImageResize=async()=>{var a,i,s,l,r,c,u,b,g,k,h,T,M,H;const e=(i=(a=o("#resize-input-select"))==null?void 0:a.value)==null?void 0:i.trim();if(!e){p("请先填写输入目录。");return}const t={script_name:"_image_resize",input_dir:e,output_dir:((l=(s=o("#resize-output"))==null?void 0:s.value)==null?void 0:l.trim())||"",format:((r=o("#resize-format"))==null?void 0:r.value)||"ORIGINAL",quality:parseInt((c=o("#resize-quality"))==null?void 0:c.value)||95,resolutions:((b=(u=o("#resize-resolutions"))==null?void 0:u.value)==null?void 0:b.trim())||"",enable_resize:((g=o("#resize-enable"))==null?void 0:g.checked)??!0,exact_size:((k=o("#resize-exact"))==null?void 0:k.checked)||!1,recursive:((h=o("#resize-recursive"))==null?void 0:h.checked)||!1,rename:((T=o("#resize-rename"))==null?void 0:T.checked)||!1,delete_original:((M=o("#resize-delete"))==null?void 0:M.checked)||!1,sync_metadata:((H=o("#resize-sync"))==null?void 0:H.checked)??!0};try{await f.runImageResize(t),p("图像预处理任务已提交，正在后台运行...")}catch(K){p(K.message||"图像预处理启动失败。")}};window.openResizeGui=()=>{p("请在 train 目录下双击「训练图像缩放预处理工具.py」打开独立图形界面。")};function $e(e){e.innerHTML=`
    <div class="form-container">
      <header class="section-title">
        <h2>训练日志</h2>
        <p>查看 TensorBoard 日志目录。可通过 TensorBoard 可视化训练过程中的损失曲线和样本图。</p>
      </header>
      <div class="section-toolbar">
        <div class="toolbar-actions toolbar-actions-only">
          <button class="btn btn-outline btn-sm" type="button" onclick="refreshLogDirs()">刷新日志列表</button>
          <button class="btn btn-outline btn-sm" type="button" onclick="openTensorBoard()">启动 TensorBoard</button>
        </div>
      </div>
      <div id="logs-list" class="module-list"><div class="builtin-picker-empty"><span>加载中...</span></div></div>
    </div>
  `,window.refreshLogDirs()}window.refreshLogDirs=async()=>{var t;const e=o("#logs-list");if(e){e.innerHTML='<div class="builtin-picker-empty"><span>加载中...</span></div>';try{const a=await f.getLogDirs(),i=((t=a==null?void 0:a.data)==null?void 0:t.dirs)||[];if(!i.length){e.innerHTML='<div class="builtin-picker-empty"><span>未检测到日志目录</span></div>';return}e.innerHTML=i.map(s=>`
      <div class="module-list-item" onclick="viewLogDetail('${d(s.name)}')">
        <div class="module-list-main">
          <strong>${d(s.name)}</strong>
          <span class="module-list-meta">${s.hasEvents?"包含 TensorBoard 事件文件":"无事件文件"}</span>
        </div>
        <span class="module-list-time">${new Date(s.time).toLocaleString("zh-CN")}</span>
      </div>
    `).join("")}catch(a){e.innerHTML=`<div class="builtin-picker-empty"><span>${d(a.message||"读取日志目录失败")}</span></div>`}}};window.viewLogDetail=async e=>{var a;const t=o("#logs-list");if(t){t.innerHTML='<div class="builtin-picker-empty"><span>加载中...</span></div>';try{const i=await f.getLogDetail(e),s=((a=i==null?void 0:i.data)==null?void 0:a.files)||[];t.innerHTML=`
      <div style="padding:0 0 12px;"><button class="btn btn-outline btn-sm" type="button" onclick="refreshLogDirs()">← 返回列表</button></div>
      <h3 style="margin-bottom:12px;font-size:1rem;">${d(e)}</h3>
      ${s.length?s.map(l=>`
        <div class="module-list-item module-list-item-static">
          <div class="module-list-main">
            <strong>${d(l.name)}</strong>
            <span class="module-list-meta">${(l.size/1024).toFixed(1)} KB</span>
          </div>
          <span class="module-list-time">${new Date(l.time).toLocaleString("zh-CN")}</span>
        </div>
      `).join(""):'<div class="builtin-picker-empty"><span>该目录为空</span></div>'}
    `}catch(i){t.innerHTML=`<div class="builtin-picker-empty"><span>${d(i.message||"读取失败")}</span></div>`}}};window.openTensorBoard=()=>{p("TensorBoard 需要通过后端启动，请在终端执行：tensorboard --logdir=./logs")};function Te(e){const t=[{id:"extract_lora",title:"从模型提取 LoRA",desc:"从两个模型的差异中提取 LoRA 网络权重。需要指定原始模型、微调模型和输出路径。",script:"networks/extract_lora_from_models.py",fields:[{key:"model_org",label:"原始模型路径",type:"text",placeholder:"./sd-models/original.safetensors"},{key:"model_tuned",label:"微调模型路径",type:"text",placeholder:"./sd-models/finetuned.safetensors"},{key:"save_to",label:"输出路径",type:"text",placeholder:"./output/extracted.safetensors"},{key:"dim",label:"网络维度 (dim)",type:"number",placeholder:"32"}]},{id:"extract_dylora",title:"从 DyLoRA 提取 LoRA",desc:"从 DyLoRA 模型中提取指定维度的 LoRA 权重。",script:"networks/extract_lora_from_dylora.py",fields:[{key:"model",label:"DyLoRA 模型路径",type:"text",placeholder:"./output/dylora.safetensors"},{key:"save_to",label:"输出路径",type:"text",placeholder:"./output/extracted.safetensors"},{key:"unit",label:"提取维度 (unit)",type:"number",placeholder:"4"}]},{id:"merge_lora",title:"合并 LoRA",desc:"将多个 LoRA 按指定权重合并为一个。支持 2~4 个 LoRA 输入。",script:"networks/merge_lora.py",fields:[{key:"save_to",label:"输出路径",type:"text",placeholder:"./output/merged.safetensors"},{key:"models",label:"LoRA 路径（空格分隔）",type:"text",placeholder:"./output/a.safetensors ./output/b.safetensors"},{key:"ratios",label:"合并权重（空格分隔）",type:"text",placeholder:"0.5 0.5"},{key:"save_precision",label:"保存精度",type:"text",placeholder:"fp16"}]},{id:"merge_models",title:"合并模型",desc:"按指定比例合并两个 Stable Diffusion 模型。",script:"tools/merge_models.py",fields:[{key:"model_0",label:"模型 A 路径",type:"text",placeholder:"./sd-models/model_a.safetensors"},{key:"model_1",label:"模型 B 路径",type:"text",placeholder:"./sd-models/model_b.safetensors"},{key:"save_to",label:"输出路径",type:"text",placeholder:"./output/merged_model.safetensors"},{key:"ratio",label:"合并比例 (0~1)",type:"text",placeholder:"0.5"},{key:"save_precision",label:"保存精度",type:"text",placeholder:"fp16"}]}];e.innerHTML=`
    <div class="form-container">
      <header class="section-title">
        <h2>工具箱</h2>
        <p>LoRA 提取、合并等实用工具。参数填写后点击运行，脚本将在后端执行。</p>
      </header>
      ${t.map(a=>`
        <section class="form-section tool-section" id="tool-${a.id}">
          <header class="section-header">
            <h3>${d(a.title)}</h3>
          </header>
          <div class="section-summary">${d(a.desc)}</div>
          <div class="section-content tool-fields">
            ${a.fields.map(i=>`
              <div class="config-group">
                <label>${d(i.label)}</label>
                <input class="text-input" type="${i.type}" id="tool-${a.id}-${i.key}" placeholder="${d(i.placeholder||"")}">
              </div>
            `).join("")}
          </div>
          <div class="tool-actions">
            <button class="btn btn-primary btn-sm" type="button" onclick="runTool('${a.id}', '${d(a.script)}', ${JSON.stringify(a.fields.map(i=>i.key)).replaceAll('"',"&quot;")})">运行</button>
          </div>
        </section>
      `).join("")}
    </div>
  `}window.runTool=async(e,t,a)=>{const i={script_name:t};for(const s of a){const l=o(`#tool-${e}-${s}`);l&&l.value.trim()&&(i[s]=l.value.trim())}try{await f.runScript(i),p(`工具「${e}」已提交运行。`)}catch(s){p(s.message||"工具运行失败。")}};window.updateConfigValue=(e,t)=>{const a=V(e),i=R(a,t),s=n.config[e];if(String(s??"")!==String(i??"")&&(n.fieldUndo[e]=s),n.config[e]=i,q.has(e)&&n.activeModule==="config"){$(),y("config");return}D()};window.pickPath=async(e,t)=>{try{const a=await f.pickFile(t);if(a.status!=="success"){p(a.message||"选择路径失败。");return}window.updateConfigValue(e,a.data.path),n.activeModule==="config"&&y("config")}catch(a){p(a.message||"选择路径失败。")}};window.runPreflight=async()=>{n.loading.preflight=!0,_();try{const e=await f.runPreflight(L(n.config));e.status!=="success"?n.preflight={can_start:!1,errors:[e.message||"训练预检失败。"],warnings:[]}:n.preflight=e.data}catch(e){n.preflight={can_start:!1,errors:[e.message||"训练预检失败。"],warnings:[]}}finally{n.loading.preflight=!1,n.activeModule==="config"?y("config"):_()}};window.runSelfCheck=async()=>{var e;p("正在执行环境自检...");try{const[t,a]=await Promise.allSettled([f.getGraphicCards(),f.runPreflight(L(n.config))]);t.status==="fulfilled"?(n.runtime=t.value.data||null,n.runtimeError=""):n.runtimeError=((e=t.reason)==null?void 0:e.message)||"运行环境不可用",a.status==="fulfilled"&&(n.preflight=a.value.data||null),p("环境自检完成")}catch(t){p(t.message||"环境自检失败")}finally{n.activeModule==="config"&&y("config")}};window.refreshRuntime=async()=>{n.loading.runtime=!0,_();try{const e=await f.getGraphicCards();n.runtime=e.data||null,n.runtimeError=""}catch(e){n.runtimeError=e.message||"运行环境状态不可用。"}finally{n.loading.runtime=!1,n.activeModule==="config"?y("config"):_()}};function Pe(){if(n.importInputBound)return;const e=o("#config-file-input");e&&(n.importInputBound=!0,e.addEventListener("change",async t=>{var i;const a=(i=t.target.files)==null?void 0:i[0];if(a)try{const s=await a.text(),l=JSON.parse(s);S(l),D(),p("配置文件已导入。")}catch(s){p(s.message||"导入配置文件失败。")}finally{e.value=""}}))}function Ve(){if(n.pickerInputBound)return;const e=o("#native-picker-input");e&&(n.pickerInputBound=!0,e.addEventListener("change",t=>{const a=e.dataset.fieldKey,i=e.dataset.fieldType,s=Array.from(t.target.files||[]);if(!a||s.length===0)return;let l="";if(i==="folder"){const r=s[0].webkitRelativePath||s[0].name;l=r.split("/")[0]||r}else l=s[0].name;window.updateConfigValue(a,l),e.value="",delete e.dataset.fieldKey,delete e.dataset.fieldType}))}function B(){const e=o("#builtin-picker-modal"),t=o("#builtin-picker-title"),a=o("#builtin-picker-path"),i=o("#builtin-picker-list"),s=document.querySelector(".builtin-picker-footer");if(s&&(s.innerHTML='<button class="btn btn-outline btn-sm" type="button" id="builtin-picker-cancel" onclick="closeBuiltinPicker()">取消</button>'),!e||!t||!a||!i||(e.classList.toggle("open",n.builtinPicker.open),!n.builtinPicker.open))return;const l=n.builtinPicker.pickerType;if(t.textContent=l==="folder"||l==="output-folder"?"请选择目录":"请选择模型文件",a.textContent=n.builtinPicker.rootLabel,!n.builtinPicker.items.length){i.innerHTML=`
      <div class="builtin-picker-empty">
        <span>未检测到内容</span>
      </div>
    `;return}i.innerHTML=n.builtinPicker.items.map(r=>`
      <button class="builtin-picker-item" type="button" onclick="selectBuiltinPickerItem('${d(r)}')">
        <span class="builtin-picker-name">${d(r)}</span>
      </button>
    `).join("")}window.openNativePicker=(e,t)=>{f.getBuiltinPicker(t).then(a=>{var i,s;n.builtinPicker={open:!0,fieldKey:e,pickerType:t,rootLabel:((i=a==null?void 0:a.data)==null?void 0:i.rootLabel)||"",items:((s=a==null?void 0:a.data)==null?void 0:s.items)||[]},B()}).catch(a=>{p(a.message||"打开内置文件选择器失败。")})};window.closeBuiltinPicker=()=>{n.builtinPicker.open=!1,B()};window.selectBuiltinPickerItem=e=>{const a=`${n.builtinPicker.rootLabel.replaceAll("\\","/")}/${e}`;n.builtinPicker.open=!1,B(),window.updateConfigValue(n.builtinPicker.fieldKey,a)};function Se(){var a,i,s;function e(){document.querySelectorAll(".field-menu-dropdown").forEach(l=>l.remove()),n.activeFieldMenu=null}function t(l,r){e(),n.activeFieldMenu=l;const c=V(l);if(!c)return;const u=n.config[c.key],b=c.defaultValue??"",g=Object.hasOwn(n.fieldUndo,c.key),k=String(u??"")!==String(b??""),h=document.createElement("div");h.className="field-menu field-menu-dropdown",h.innerHTML=`
      <button class="field-menu-item ${g?"":"disabled"}" type="button" ${g?"":"disabled"}>撤销更改</button>
      <button class="field-menu-item ${k?"":"disabled"}" type="button" ${k?"":"disabled"}>恢复默认</button>
    `,h.addEventListener("click",M=>M.stopPropagation());const T=h.querySelectorAll(".field-menu-item");g&&T[0].addEventListener("click",()=>{e(),window.undoFieldValue(l)}),k&&T[1].addEventListener("click",()=>{e(),window.resetFieldValue(l)}),r.appendChild(h)}document.addEventListener("click",l=>{var c,u,b,g;const r=(u=(c=l.target)==null?void 0:c.closest)==null?void 0:u.call(c,"[data-field-menu-key]");if(r){l.preventDefault(),l.stopPropagation();const k=r.dataset.fieldMenuKey;if(n.activeFieldMenu===k)e();else{const h=r.closest(".field-inline-actions");h&&t(k,h)}return}(g=(b=l.target)==null?void 0:b.closest)!=null&&g.call(b,".field-menu-dropdown")||n.activeFieldMenu&&e()}),(a=o("#builtin-picker-close"))==null||a.addEventListener("click",window.closeBuiltinPicker),(i=o("#builtin-picker-cancel"))==null||i.addEventListener("click",window.closeBuiltinPicker),(s=o("#builtin-picker-modal"))==null||s.addEventListener("click",l=>{var r;((r=l.target)==null?void 0:r.id)==="builtin-picker-modal"&&window.closeBuiltinPicker()})}window.resetAllParams=()=>{n.config=G(),n.hasLocalDraft=!1,localStorage.removeItem(z),I(),n.activeModule==="config"?y("config"):_()};window.saveCurrentParams=()=>{const e="Angela",t=o("#builtin-picker-modal"),a=o("#builtin-picker-title"),i=o("#builtin-picker-path"),s=o("#builtin-picker-list");if(!t||!a||!i||!s)return;a.textContent="保存当前参数",i.textContent="请输入保存名称，保存后会直接写入本地文件。",s.innerHTML=`
    <div class="save-params-form">
      <input type="text" id="save-params-name" class="text-input" value="${d(e)}" placeholder="输入参数名称">
      <button class="btn btn-primary btn-sm" type="button" id="save-params-confirm">保存</button>
    </div>
  `,t.classList.add("open");const l=o("#save-params-name"),r=o("#save-params-confirm"),c=async()=>{var b;const u=(b=l==null?void 0:l.value)==null?void 0:b.trim();if(!u){i&&(i.textContent="请输入保存名称。"),l==null||l.focus();return}try{await f.saveConfig(u,L(n.config)),$(),n.hasLocalDraft=!0,t.classList.remove("open"),p("参数已保存："+u),n.activeModule==="config"?y("config"):j()}catch(g){i&&(i.textContent=g.message||"保存失败。"),l&&(l.style.borderColor="var(--danger, #d9534f)",l.focus(),l.select())}};r==null||r.addEventListener("click",c,{once:!0}),l==null||l.addEventListener("keydown",u=>{u.key==="Enter"&&(u.preventDefault(),c())},{once:!0}),l==null||l.focus(),l==null||l.select()};window.loadSavedParams=async()=>{var l;const e=o("#builtin-picker-modal"),t=o("#builtin-picker-title"),a=o("#builtin-picker-path"),i=o("#builtin-picker-list");if(!e||!t||!a||!i)return;t.textContent="读取已保存参数",a.textContent="选择一个已保存的参数，点击后立即载入。",i.innerHTML='<div class="builtin-picker-empty"><span>加载中...</span></div>';const s=document.querySelector(".builtin-picker-footer");s&&(s.innerHTML='<button class="btn btn-outline btn-sm" type="button" id="builtin-picker-cancel" onclick="closeBuiltinPicker()">取消</button>'),e.classList.add("open");try{const r=await f.listSavedConfigs(),c=((l=r==null?void 0:r.data)==null?void 0:l.configs)||[];if(!c.length){i.innerHTML='<div class="builtin-picker-empty"><span>未检测到内容</span></div>';return}i.innerHTML=c.map(u=>`
      <div class="builtin-picker-item" type="button">
        <span class="builtin-picker-name">${d(u.name)}</span>
        <span class="builtin-picker-time">${new Date(u.time).toLocaleString("zh-CN")}</span>
        <button class="btn btn-outline btn-sm btn-picker-action" type="button" onclick="previewSavedConfig('${d(u.name)}')">预览</button>
        <button class="btn btn-outline btn-sm btn-picker-action" type="button" onclick="loadNamedConfig('${d(u.name)}')">载入</button>
        <button class="builtin-picker-delete-btn" type="button" title="删除" onclick="event.stopPropagation(); deleteSavedConfig('${d(u.name)}')">✕</button>
      </div>
    `).join("")}catch(r){a.textContent=r.message||"读取列表失败。",i.innerHTML='<div class="builtin-picker-empty"><span>未检测到内容</span></div>'}};window.loadNamedConfig=async e=>{const t=o("#builtin-picker-path");try{const a=await f.loadSavedConfig(e),i=a==null?void 0:a.data;if(!i)throw new Error("参数内容为空。");S(i),n.hasLocalDraft=!0,I(),$(),window.closeBuiltinPicker(),p("已载入参数："+e),n.activeModule==="config"?y("config"):j()}catch(a){t&&(t.textContent=a.message||"读取参数失败。")}};window.deleteSavedConfig=async e=>{try{await f.deleteSavedConfig(e),p("已删除："+e),window.loadSavedParams()}catch(t){p(t.message||"删除失败")}};window.previewSavedConfig=async e=>{const t=o("#builtin-picker-title"),a=o("#builtin-picker-path"),i=o("#builtin-picker-list");if(!t||!a||!i)return;t.textContent=`参数预览：${e}`,a.textContent="加载中...",i.innerHTML='<div class="builtin-picker-empty"><span>加载中...</span></div>';const s=document.querySelector(".builtin-picker-footer");s&&(s.innerHTML='<button class="btn btn-outline btn-sm" type="button" onclick="loadSavedParams()">← 返回列表</button><button class="btn btn-outline btn-sm" type="button" id="builtin-picker-cancel" onclick="closeBuiltinPicker()">取消</button>');try{const l=await f.loadSavedConfig(e),r=l==null?void 0:l.data;if(!r)throw new Error("参数内容为空。");const c=Object.entries(r);a.textContent=`共 ${c.length} 个参数`,i.innerHTML=`
      <div class="params-preview-list">
        ${c.map(([u,b])=>{const g=typeof b=="object"?JSON.stringify(b):String(b??"");return`<div class="params-preview-row"><span class="params-key">${d(u)}</span><span class="params-val">${d(g)}</span></div>`}).join("")}
      </div>
    `}catch(l){a.textContent=l.message||"预览失败。"}};window.downloadConfigFile=()=>{const e=new Blob([JSON.stringify(L(n.config),null,2)],{type:"application/json;charset=utf-8"}),t=URL.createObjectURL(e),a=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19),i=document.createElement("a");i.href=t,i.download=`sdxl-lora-${a}.json`,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(t)};window.importConfigFile=()=>{var e;(e=o("#config-file-input"))==null||e.click()};window.resetFieldValue=e=>{const t=V(e);t&&(n.activeFieldMenu=null,window.updateConfigValue(e,t.defaultValue??""))};window.undoFieldValue=e=>{if(!Object.hasOwn(n.fieldUndo,e))return;const t=n.fieldUndo[e];delete n.fieldUndo[e],n.activeFieldMenu=null;const a=V(e);if(n.config[e]=R(a,t),q.has(e)&&n.activeModule==="config")return D();D()};window.updateLayoutWidth=(e,t,a=!0)=>{const i=Number(t);Number.isNaN(i)||(e==="navigator"?n.navigatorWidth=i:e==="json"&&(n.jsonPanelWidth=i),a?J():C(),n.activeModule==="settings"&&(o("#navigator-width-value").textContent=`${n.navigatorWidth}px`,o("#json-width-value").textContent=`${n.jsonPanelWidth}px`))};window.executeTraining=async()=>{var e,t;n.loading.run=!0,W();try{const a=await f.runPreflight(L(n.config));if(a.status!=="success"||!((e=a.data)!=null&&e.can_start)){n.preflight=a.data||{can_start:!1,errors:[a.message||"训练预检阻止了本次训练。"],warnings:[]},p("预检未通过，请先修正错误。");return}n.preflight=a.data;const i=await f.runTraining(L(n.config));if(i.status!=="success"){p(i.message||"训练启动失败。");return}n.lastMessage=i.message||"训练已启动。",p(n.lastMessage);const s=await f.getTasks();n.tasks=((t=s==null?void 0:s.data)==null?void 0:t.tasks)||[]}catch(a){p(a.message||"训练请求失败。")}finally{n.loading.run=!1,n.activeModule==="config"?y("config"):_()}};window.applyPreset=e=>{const t=n.presets[e];t&&(S(t),n.hasLocalDraft=!0,I(),$(),y("config"))};window.terminateAllTasks=async()=>{var t;const e=n.tasks.filter(a=>a.status==="RUNNING");if(!e.length){p("当前没有运行中的任务。");return}try{for(const i of e)await f.terminateTask(i.task_id||i.id);p("已发送终止请求。");const a=await f.getTasks();n.tasks=((t=a==null?void 0:a.data)==null?void 0:t.tasks)||[],W(),n.activeModule==="config"&&y("config")}catch(a){p(a.message||"终止任务失败。")}};document.addEventListener("DOMContentLoaded",te);
