import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CloudUpload,
  Eye,
  FileImage,
  Lightbulb,
  Loader2,
  RotateCcw,
  Save,
  ScanLine,
  ShieldCheck,
} from 'lucide-react'
import { AppTopbar } from './AppTopbar'
import { DisclaimerBar } from './DisclaimerBar'
import { SidebarNavigation } from './SidebarNavigation'
import type { AppPage } from './SidebarNavigation'
import { uploadTongueImage } from '../lib/api'
import { formatDemoDateTime } from '../lib/demoDates'
import type { User } from '../types/index'

type TongueUploadState = 'EMPTY' | 'SELECTED' | 'UPLOADING' | 'CHECKING' | 'RECORDED' | 'QUALITY_LOW' | 'FAILED'

type TongueUploadPageProps = {
  currentSessionId: string
  debugPanel: ReactNode
  user: User | null
  onUploadComplete: () => Promise<void>
  onLogout: () => void
  onNavigate: (page: AppPage) => void
}

const recentTongueRecords = [
  { time: formatDemoDateTime(0, 10, 32), quality: '清晰', region: '已识别', status: '已加入观察卡' },
  { time: formatDemoDateTime(1, 22, 15), quality: '略暗', region: '已识别', status: '已保存' },
  { time: formatDemoDateTime(2, 16, 45), quality: '舌体不完整', region: '不完整', status: '建议重拍' },
  { time: formatDemoDateTime(3, 9, 20), quality: '清晰', region: '已识别', status: '已加入观察卡' },
]

export function TongueUploadPage({
  currentSessionId,
  debugPanel,
  user,
  onLogout,
  onNavigate,
  onUploadComplete,
}: TongueUploadPageProps) {
  const [uploadState, setUploadState] = useState<TongueUploadState>('EMPTY')
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [failureMessage, setFailureMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleSelectFile(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFailureMessage('图片上传失败，请选择 JPG 或 PNG 图片后重试')
      setUploadState('FAILED')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setSelectedFile(file)
    setFileName(file.name)
    setFailureMessage('')
    setUploadState('SELECTED')
  }

  async function handleSaveRecord() {
    if (!selectedFile || !previewUrl) {
      setFailureMessage('请先选择一张舌象图片')
      setUploadState('FAILED')
      return
    }

    setFailureMessage('')
    setUploadState('UPLOADING')

    try {
      await wait(520)
      setUploadState('CHECKING')

      if (user && currentSessionId) {
        await uploadTongueImage(currentSessionId, user.user_id, selectedFile)
        await onUploadComplete()
      } else {
        await wait(600)
      }

      setUploadState(fileName.toLowerCase().includes('blur') || fileName.toLowerCase().includes('dark') ? 'QUALITY_LOW' : 'RECORDED')
    } catch (err) {
      setFailureMessage(err instanceof Error ? `图片上传失败：${err.message}` : '图片上传失败，请检查网络后重试')
      setUploadState('FAILED')
    }
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setSelectedFile(null)
    setFileName('')
    setFailureMessage('')
    setUploadState('EMPTY')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenTips() {
    document.querySelector('.tongue-tip-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <main className="home-shell tongue-page-shell">
      <SidebarNavigation activePage="tongue" onNavigate={onNavigate} />

      <section className="tongue-page-main">
        <AppTopbar className="tongue-topbar" user={user} onLogout={onLogout} onNavigate={onNavigate} />

        <header className="tongue-page-title">
          <div>
            <h1>
              舌象上传
              <span>
                <ScanLine size={22} />
              </span>
            </h1>
            <p>上传一张舌象图片，记录本次状态观察素材</p>
          </div>
        </header>

        {failureMessage && (
          <section className="tongue-message is-error">
            <CloudUpload size={18} />
            {failureMessage}
          </section>
        )}

        <section className="tongue-workspace">
          <TongueUploadMainCard
            fileInputRef={fileInputRef}
            fileName={fileName}
            previewUrl={previewUrl}
            state={uploadState}
            onChoose={() => fileInputRef.current?.click()}
            onReset={handleReset}
            onSave={handleSaveRecord}
            onSelectFile={handleSelectFile}
            onOpenTips={handleOpenTips}
          />

          <aside className="tongue-side-stack">
            <TongueCaptureTipsCard />
            <TongueImageStatusCard state={uploadState} />
          </aside>
        </section>

        <section className="tongue-bottom-grid">
          <TongueRecentRecords onChooseAgain={() => fileInputRef.current?.click()} onOpenRecords={() => onNavigate('records')} />
          <TongueObservationEntry onOpenObservation={() => onNavigate('observation')} />
        </section>

        {debugPanel}

        <DisclaimerBar />
      </section>
    </main>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function TongueUploadMainCard({
  fileInputRef,
  fileName,
  previewUrl,
  state,
  onChoose,
  onReset,
  onSave,
  onSelectFile,
  onOpenTips,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  fileName: string
  previewUrl: string
  state: TongueUploadState
  onChoose: () => void
  onReset: () => void
  onSave: () => void
  onSelectFile: (file?: File) => void
  onOpenTips: () => void
}) {
  const busy = state === 'UPLOADING' || state === 'CHECKING'
  const recorded = state === 'RECORDED' || state === 'QUALITY_LOW'
  const qualityLow = state === 'QUALITY_LOW' || fileName.toLowerCase().includes('blur') || fileName.toLowerCase().includes('dark')

  return (
    <section className={`tongue-main-card state-${state.toLowerCase()}`}>
      <input
        ref={fileInputRef}
        className="tongue-file-input"
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={(event) => onSelectFile(event.target.files?.[0])}
      />

      <div className="tongue-main-head">
        <div>
          <h2>{getUploadTitle(state)}</h2>
          <p>{getUploadDescription(state)}</p>
        </div>
        <span>{getUploadBadge(state)}</span>
      </div>

      {!previewUrl ? (
        <button className="tongue-dropzone" onClick={onChoose} type="button">
          <span>
            <Camera size={52} />
            <i>+</i>
          </span>
          <strong>点击上传舌象图片</strong>
          <p>支持 JPG / PNG 格式，建议在自然光下拍摄</p>
          <em>
            <CloudUpload size={20} />
            选择图片
          </em>
          <small>或将图片拖拽到此处</small>
        </button>
      ) : (
        <div className="tongue-preview-panel">
          <div className="tongue-image-preview">
            <img src={previewUrl} alt="舌象图片预览" />
            <span className="tongue-scan-frame"></span>
            {busy && (
              <div className="tongue-upload-overlay">
                <Loader2 className="animate-spin" size={34} />
                {state === 'UPLOADING' ? '正在上传图片' : '正在检查图片质量'}
              </div>
            )}
          </div>
          <div className="tongue-preview-meta">
            <strong>{fileName || '本次舌象图片'}</strong>
            <p>{qualityLow ? '图片质量略低，建议确认后再保存。' : '请确认图片清晰，舌体尽量完整入镜。'}</p>
          </div>
          <div className="tongue-action-row">
            <button className="tongue-secondary-button" disabled={busy} onClick={onReset} type="button">
              <RotateCcw size={18} />
              重新上传
            </button>
            <button className="tongue-primary-button" disabled={busy || recorded} onClick={onSave} type="button">
              {busy ? <Loader2 className="animate-spin" size={18} /> : recorded ? <CheckCircle2 size={18} /> : <Save size={18} />}
              {recorded ? '已保存本次记录' : '保存本次记录'}
            </button>
          </div>
        </div>
      )}

      <button className="tongue-help-link" onClick={onOpenTips} type="button">
        <Lightbulb size={18} />
        不会拍摄？查看拍摄小贴士
      </button>
    </section>
  )
}

function TongueCaptureTipsCard() {
  const tips = [
    ['自然光下拍摄', '避免强光直射或光线过暗', <Lightbulb size={21} />],
    ['舌体尽量完整入镜', '请伸舌自然，舌体居中', <ScanLine size={21} />],
    ['保持画面清晰', '对焦清楚，避免模糊', <Camera size={21} />],
    ['避免遮挡与反光', '不要有牙齿、手指等遮挡', <Eye size={21} />],
  ]

  return (
    <section className="tongue-side-card">
      <h2>拍摄小贴士</h2>
      <div className="tongue-tip-list">
        {tips.map(([title, body, icon]) => (
          <div className="tongue-tip-item" key={String(title)}>
            <span>{icon}</span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TongueImageStatusCard({ state }: { state: TongueUploadState }) {
  const status = getImageStatusRows(state)
  return (
    <section className="tongue-side-card">
      <h2>图片状态</h2>
      <div className="tongue-status-list">
        {status.map((item) => (
          <div className="tongue-status-row" key={item.label}>
            <span>{item.icon}</span>
            <p>{item.label}</p>
            <strong className={item.tone}>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function TongueRecentRecords({
  onChooseAgain,
  onOpenRecords,
}: {
  onChooseAgain: () => void
  onOpenRecords: () => void
}) {
  return (
    <section className="tongue-record-card">
      <div className="tongue-record-head">
        <h2>最近舌象记录</h2>
        <button onClick={onOpenRecords} type="button">查看全部 〉</button>
      </div>
      <div className="tongue-record-table">
        {recentTongueRecords.map((record, index) => (
          <div className="tongue-record-row" key={record.time}>
            <span className="tongue-thumb" aria-hidden="true">
              <i></i>
            </span>
            <p>{record.time}</p>
            <strong className={record.quality === '舌体不完整' ? 'is-warning' : ''}>{record.quality}</strong>
            <strong className={record.region === '不完整' ? 'is-warning' : ''}>{record.region}</strong>
            <em className={record.status === '建议重拍' ? 'is-warning' : ''}>{record.status}</em>
            <button onClick={index === 2 ? onChooseAgain : onOpenRecords} type="button">
              {index === 2 ? '重新选择' : '查看详情'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function TongueObservationEntry({ onOpenObservation }: { onOpenObservation: () => void }) {
  return (
    <section className="tongue-observation-entry">
      <span>
        <ClipboardCheck size={30} />
      </span>
      <h2>上传后可生成观察卡</h2>
      <p>舌象可单独上传，也可以与心率记录一起汇总到观察卡。</p>
      <button onClick={onOpenObservation} type="button">
        去查看观察卡
        <i>→</i>
      </button>
    </section>
  )
}

function getUploadTitle(state: TongueUploadState) {
  const title: Record<TongueUploadState, string> = {
    EMPTY: '上传舌象图片',
    SELECTED: '确认舌象图片',
    UPLOADING: '正在上传图片',
    CHECKING: '正在检查图片质量',
    RECORDED: '舌象图片已记录',
    QUALITY_LOW: '图片质量需要确认',
    FAILED: '上传遇到问题',
  }
  return title[state]
}

function getUploadDescription(state: TongueUploadState) {
  const description: Record<TongueUploadState, string> = {
    EMPTY: '请上传一张清晰的舌象照片，用于本次状态观察记录。',
    SELECTED: '请确认图片清晰，舌体尽量完整入镜。',
    UPLOADING: '请稍等，系统正在保存本次舌象图片。',
    CHECKING: '系统正在检查图片清晰度、光线和舌体区域完整度。',
    RECORDED: '本次图片已保存，可用于生成观察卡。',
    QUALITY_LOW: '图片可能存在略暗或轻微模糊，建议确认后保存或重新上传。',
    FAILED: '图片上传失败，请检查网络或图片格式后重试。',
  }
  return description[state]
}

function getUploadBadge(state: TongueUploadState) {
  const badge: Record<TongueUploadState, string> = {
    EMPTY: '未上传',
    SELECTED: '待保存',
    UPLOADING: '上传中',
    CHECKING: '检查中',
    RECORDED: '已记录',
    QUALITY_LOW: '建议确认',
    FAILED: '上传失败',
  }
  return badge[state]
}

function getImageStatusRows(state: TongueUploadState) {
  const uploaded = state === 'SELECTED' || state === 'CHECKING' || state === 'RECORDED' || state === 'QUALITY_LOW'
  const busy = state === 'UPLOADING' || state === 'CHECKING'
  const recorded = state === 'RECORDED' || state === 'QUALITY_LOW'
  const low = state === 'QUALITY_LOW'

  return [
    {
      icon: <CloudUpload size={18} />,
      label: '上传状态',
      value: state === 'EMPTY' ? '待上传' : state === 'UPLOADING' ? '上传中' : state === 'FAILED' ? '上传失败' : '已上传',
      tone: state === 'FAILED' ? 'is-warning' : '',
    },
    {
      icon: <FileImage size={18} />,
      label: '图片质量',
      value: state === 'EMPTY' ? '待检查' : busy ? '检查中' : low ? '轻微模糊' : uploaded ? '清晰' : '待检查',
      tone: low ? 'is-warning' : '',
    },
    {
      icon: <ScanLine size={18} />,
      label: '舌体区域',
      value: state === 'EMPTY' ? '待识别' : low ? '建议确认' : uploaded ? '已识别' : '待识别',
      tone: low ? 'is-warning' : '',
    },
    {
      icon: <ShieldCheck size={18} />,
      label: '记录状态',
      value: recorded ? '已保存' : '未保存',
      tone: recorded ? 'is-good' : '',
    },
  ]
}
