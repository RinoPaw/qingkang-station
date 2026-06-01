function demoDate(daysAgo: number, hour = 10, minute = 32) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date
}

export function formatDemoDateTime(daysAgo: number, hour = 10, minute = 32) {
  const date = demoDate(daysAgo, hour, minute)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const cleanHour = String(date.getHours()).padStart(2, '0')
  const cleanMinute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${cleanHour}:${cleanMinute}`
}

export function formatDemoMonthDay(daysAgo: number) {
  const date = demoDate(daysAgo)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

export function demoWeekLabels() {
  return Array.from({ length: 7 }, (_, index) => formatDemoMonthDay(6 - index))
}
