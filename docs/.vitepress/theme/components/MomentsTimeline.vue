<script setup lang="ts">
import { computed } from 'vue'
import { moments, type Moment } from '../data/moments'

interface MomentGroup {
  key: string
  day: string
  weekday: string
  items: Moment[]
}

function parseMomentDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)

  if (!match) {
    return new Date(value)
  }

  const [, year, month, day, hour = '00', minute = '00'] = match
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
}

function dayKey(value: string) {
  return value.slice(0, 10)
}

function formatDay(value: string) {
  const date = parseMomentDate(value)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function formatWeekday(value: string) {
  const date = parseMomentDate(value)
  return new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long'
  }).format(date)
}

function formatTime(value: string) {
  const date = parseMomentDate(value)
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

const sortedMoments = computed(() => {
  return [...moments].sort((a, b) => {
    return parseMomentDate(b.date).getTime() - parseMomentDate(a.date).getTime()
  })
})

const momentGroups = computed<MomentGroup[]>(() => {
  const groups: MomentGroup[] = []
  const groupMap = new Map<string, MomentGroup>()

  for (const moment of sortedMoments.value) {
    const key = dayKey(moment.date)
    let group = groupMap.get(key)

    if (!group) {
      group = {
        key,
        day: formatDay(moment.date),
        weekday: formatWeekday(moment.date),
        items: []
      }
      groups.push(group)
      groupMap.set(key, group)
    }

    group.items.push(moment)
  }

  return groups
})

const totalMoments = computed(() => sortedMoments.value.length)
const latestMoment = computed(() => sortedMoments.value[0])
</script>

<template>
  <section class="moments-page">
    <div class="moments-wallpaper" aria-hidden="true" />

    <div class="moments-shell">
      <header class="moments-hero">
        <h1>瞬间</h1>
        <p>一句话，放下此刻的心情和感受。</p>

        <div v-if="latestMoment" class="moments-summary">
          <span>{{ totalMoments }} 条记录</span>
          <span>最近 {{ formatDay(latestMoment.date) }}</span>
        </div>
      </header>

      <div v-if="!totalMoments" class="moments-empty">
        还没有记录。第一句话，会成为这里的光。
      </div>

      <div v-else class="moments-timeline" aria-label="瞬间时间线">
        <section v-for="group in momentGroups" :key="group.key" class="moments-day">
          <div class="moments-day-label">
            <time :datetime="group.key">{{ group.day }}</time>
            <span>{{ group.weekday }}</span>
          </div>

          <div class="moments-list">
            <article
              v-for="moment in group.items"
              :key="moment.id"
              class="moment-row"
              :style="{ '--moment-accent': moment.color || 'var(--moment-accent-default)' }"
            >
              <time class="moment-time" :datetime="moment.date">{{ formatTime(moment.date) }}</time>
              <div class="moment-body">
                <div class="moment-meta">
                  <span v-if="moment.mood">{{ moment.mood }}</span>
                  <span v-if="moment.weather">{{ moment.weather }}</span>
                  <span v-if="moment.location">{{ moment.location }}</span>
                </div>

                <p>{{ moment.content }}</p>

                <div v-if="moment.tags?.length" class="moment-tags" aria-label="标签">
                  <span v-for="tag in moment.tags" :key="tag">{{ tag }}</span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.moments-page {
  position: relative;
  margin: -18px 0 72px;
  min-height: calc(100vh - var(--vp-nav-height));
  padding: 46px 0 82px;
  overflow: hidden;
}

.moments-wallpaper {
  position: fixed;
  inset: var(--vp-nav-height) 0 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(90deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.86) 42%, rgba(255, 255, 255, 0.52) 72%, rgba(255, 255, 255, 0.22) 100%),
    url('/moments-bg.jpg');
  background-position: center bottom;
  background-size: cover;
}

.moments-shell {
  --moment-ink: var(--vp-c-text-1);
  --moment-muted: var(--vp-c-text-2);
  --moment-soft: var(--vp-c-text-3);
  --moment-line: var(--vp-c-divider);
  --moment-accent-default: var(--vp-c-brand-1);

  position: relative;
  z-index: 1;
  margin: 0 auto;
  max-width: 720px;
  color: var(--moment-ink);
}

.moments-hero {
  padding: 18px 0 30px;
  border-bottom: 1px solid var(--moment-line);
}

.moments-hero h1 {
  margin: 0;
  color: var(--moment-ink);
  font-size: 34px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0;
}

.moments-hero p {
  margin: 12px 0 0;
  max-width: 360px;
  color: var(--moment-muted);
  font-size: 15px;
  line-height: 1.8;
}

.moments-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
  color: var(--moment-soft);
  font-size: 13px;
  line-height: 1.6;
}

.moments-summary span + span::before {
  content: "/";
  margin-right: 12px;
  color: var(--moment-line);
}

.moments-empty {
  margin-top: 30px;
  border-left: 2px solid var(--vp-c-brand-1);
  padding: 6px 0 6px 18px;
  color: var(--moment-muted);
  font-size: 15px;
}

.moments-timeline {
  position: relative;
  padding-top: 34px;
}

.moments-day {
  display: grid;
  grid-template-columns: 122px minmax(0, 1fr);
  gap: 42px;
  position: relative;
}

.moments-day + .moments-day {
  margin-top: 36px;
}

.moments-day-label {
  position: sticky;
  top: 88px;
  align-self: start;
  padding-top: 4px;
  color: var(--moment-soft);
}

.moments-day-label time {
  display: block;
  color: var(--moment-muted);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.moments-day-label span {
  display: block;
  margin-top: 8px;
  font-size: 12px;
}

.moments-list {
  position: relative;
  min-width: 0;
  border-left: 1px solid var(--moment-line);
}

.moment-row {
  --moment-accent: var(--moment-accent-default);

  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 22px;
  position: relative;
  padding: 0 0 28px 28px;
}

.moment-row::before {
  content: "";
  position: absolute;
  top: 7px;
  left: -4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--moment-accent);
}

.moment-row + .moment-row {
  margin-top: 4px;
}

.moment-time {
  padding-top: 1px;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.moment-body {
  min-width: 0;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--moment-line);
}

.moment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
  color: var(--moment-soft);
  font-size: 12px;
  line-height: 1.5;
}

.moment-meta span::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 3px;
  margin: 0 8px 2px 0;
  border-radius: 50%;
  background: var(--moment-line);
}

.moment-body p {
  margin: 0;
  color: var(--moment-ink);
  font-size: 18px;
  line-height: 2;
  overflow-wrap: anywhere;
}

.moment-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.moment-tags span {
  color: var(--moment-soft);
  font-size: 12px;
  line-height: 1.6;
}

.moment-tags span::before {
  content: "#";
  color: var(--vp-c-brand-1);
}

html.dark .moments-wallpaper {
  background-image:
    linear-gradient(90deg, rgba(18, 18, 18, 0.92) 0%, rgba(18, 18, 18, 0.82) 48%, rgba(18, 18, 18, 0.58) 78%, rgba(18, 18, 18, 0.36) 100%),
    url('/moments-bg.jpg');
}

@media (max-width: 720px) {
  .moments-page {
    margin-top: -10px;
    padding: 34px 0 68px;
  }

  .moments-wallpaper {
    background-image:
      linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.88) 46%, rgba(255, 255, 255, 0.74) 100%),
      url('/moments-bg.jpg');
    background-position: center bottom;
  }

  html.dark .moments-wallpaper {
    background-image:
      linear-gradient(180deg, rgba(18, 18, 18, 0.9) 0%, rgba(18, 18, 18, 0.86) 52%, rgba(18, 18, 18, 0.74) 100%),
      url('/moments-bg.jpg');
  }

  .moments-shell {
    margin-top: 0;
  }

  .moments-hero {
    padding-top: 10px;
  }

  .moments-hero h1 {
    font-size: 30px;
  }

  .moments-day {
    display: block;
  }

  .moments-day-label {
    position: relative;
    top: auto;
    margin-bottom: 18px;
    padding-top: 0;
  }

  .moments-list {
    margin-left: 5px;
  }

  .moment-row {
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 16px;
    padding-left: 22px;
  }

  .moment-body p {
    font-size: 17px;
  }
}
</style>
