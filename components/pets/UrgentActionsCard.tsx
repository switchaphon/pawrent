'use client'

import { TriangleAlert, Pill, Scale, Weight } from 'lucide-react'

export type UrgentItemType = 'parasite_overdue' | 'vaccine_overdue' | 'weight_stale'

export interface UrgentItem {
  id: string
  type: UrgentItemType
  title: string
  detail: string
  severity: 'danger' | 'warning'
  onAction: () => void
}

interface UrgentActionsCardProps {
  items: UrgentItem[]
  isMemorial: boolean
}

function ItemIcon({ type, severity }: { type: UrgentItemType; severity: 'danger' | 'warning' }) {
  const iconClass = 'w-[18px] h-[18px]'
  const icon =
    type === 'vaccine_overdue' ? (
      <Pill className={iconClass} aria-hidden />
    ) : type === 'parasite_overdue' ? (
      <Pill className={iconClass} aria-hidden />
    ) : (
      <Scale className={iconClass} aria-hidden />
    )

  return (
    <div
      aria-hidden
      className={[
        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
        severity === 'danger'
          ? 'bg-danger-bg text-danger'
          : 'bg-warning-bg text-warning',
      ].join(' ')}
    >
      {icon}
    </div>
  )
}

export function UrgentActionsCard({ items, isMemorial }: UrgentActionsCardProps) {
  if (items.length === 0 || isMemorial) return null

  return (
    <div
      role="region"
      aria-label="รายการที่ต้องทำ"
      className="mx-4 mb-[14px] bg-surface border border-border rounded-[16px] shadow-soft overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2 text-[12px] font-extrabold text-text-main">
          <div
            aria-hidden
            className="w-6 h-6 rounded-full bg-danger-bg text-danger flex items-center justify-center"
          >
            <TriangleAlert className="w-3 h-3" aria-hidden />
          </div>
          ที่ต้องทำ
        </div>
        <span
          role="status"
          aria-label={`${items.length} รายการ`}
          className="px-2 py-[2px] rounded-full bg-danger-bg text-danger text-[10px] font-bold"
        >
          {items.length} รายการ
        </span>
      </div>

      {/* Items */}
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle last:border-b-0"
        >
          <ItemIcon type={item.type} severity={item.severity} />

          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-text-main">{item.title}</div>
            <div
              className={[
                'text-[10px] mt-[1px]',
                item.severity === 'danger'
                  ? 'text-danger font-semibold'
                  : 'text-text-muted',
              ].join(' ')}
            >
              {item.detail}
            </div>
          </div>

          {item.severity === 'danger' ? (
            <button
              type="button"
              onClick={item.onAction}
              className="flex-shrink-0 flex items-center gap-1 px-[14px] py-2 rounded-full bg-primary-gradient text-white text-[11px] font-bold shadow-primary min-h-[36px]"
              aria-label={`ทำตอนนี้: ${item.title}`}
            >
              ทำตอนนี้
            </button>
          ) : (
            <button
              type="button"
              onClick={item.onAction}
              className="flex-shrink-0 flex items-center gap-1 px-[14px] py-2 rounded-full bg-surface border border-[1.5px] border-border text-text-subtle text-[11px] font-bold min-h-[36px]"
              aria-label={`บันทึก: ${item.title}`}
            >
              บันทึก
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
