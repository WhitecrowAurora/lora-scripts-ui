// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
export function describeJobStatus(status) {
  return status === 'cancel_timeout'
    ? '取消超时：任务仍占用执行资源，正在继续跟踪。'
    : String(status || 'pending');
}
