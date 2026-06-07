export interface Moment {
  id: string
  date: string
  content: string
  mood?: string
  tags?: string[]
  weather?: string
  location?: string
  color?: string
}

export const moments: Moment[] = [
  {
    id: '2026-06-06-2045',
    date: '2026-06-06 20:45',
    content: '给当下留一格呼吸。',
    mood: '平静',
    tags: ['生活', '瞬间']
  },
  {
    id: '2026-06-06-22237',
    date: '2026-06-06 22:37',
    content: '戒骄戒躁，保持平常心。',
    mood: '平静',
    tags: ['生活', '瞬间']
  }
]
