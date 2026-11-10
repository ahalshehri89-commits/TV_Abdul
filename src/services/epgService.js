/**
 * TV_Abdul v2.0: EPGService
 * Real-time Electronic Program Guide (EPG) generator & scheduler.
 * Dynamically calculates "Now Playing" and "Up Next" schedules based on local time.
 */

const DEFAULT_PROGRAMS = [
  { title: 'نشرة الأخبار الرئيسية • Main News Bulletin', durationMinutes: 60, desc: 'تغطية شاملة لأهم الأخبار المحلية والإقليمية والعالمية.' },
  { title: 'تحت الضوء • In Focus Documentary', durationMinutes: 30, desc: 'وثائقي استقصائي يتناول قضايا الساعة بعمق وموضوعية.' },
  { title: 'الحصاد الرياضي • Daily Sports Roundup', durationMinutes: 45, desc: 'ملخص يومي لأهم مباريات كرة القدم والبطولات العالمية.' },
  { title: 'برنامج حواري مسائي • Evening Talk Show', durationMinutes: 60, desc: 'حوار مفتوح مع أبرز المحللين والخبراء وصناع القرار.' },
  { title: 'بانوراما العالم • World Panorama', durationMinutes: 45, desc: 'جولة حول العالم لرصد أبرز الأحداث السياسية والاقتصادية.' },
  { title: 'استديو التحليل الفني • Match Analysis', durationMinutes: 60, desc: 'تحليل تكتيكي لأبرز مباريات الدوري والبطولات القارية.' },
  { title: 'فيلم السهرة الكلاسيكي • Evening Feature Film', durationMinutes: 120, desc: 'عرض سينمائي مختار من روائع السينما العربية والعالمية.' },
  { title: 'جولة الصباح والطقس • Morning Show & Weather', durationMinutes: 60, desc: 'فقرات صباحية منوعة وأخبار الطقس وحركة المرور.' }
];

class EPGService {
  constructor() {
    this.cache = new Map();
  }

  getChannelSchedule(channelId, date = new Date()) {
    const dayKey = `${channelId}-${date.toDateString()}`;
    if (this.cache.has(dayKey)) {
      return this.cache.get(dayKey);
    }

    // Deterministically generate a 24-hour schedule for the channel using hash of channelId
    let hash = 0;
    const str = String(channelId);
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const offset = Math.abs(hash) % DEFAULT_PROGRAMS.length;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const schedule = [];
    let currentMs = startOfDay.getTime();
    const endOfDayMs = currentMs + 24 * 60 * 60 * 1000;

    let idx = offset;
    while (currentMs < endOfDayMs) {
      const template = DEFAULT_PROGRAMS[idx % DEFAULT_PROGRAMS.length];
      const durationMs = template.durationMinutes * 60 * 1000;
      const endMs = Math.min(currentMs + durationMs, endOfDayMs);

      const startTime = new Date(currentMs);
      const endTime = new Date(endMs);

      schedule.push({
        id: `${channelId}-${currentMs}`,
        title: template.title,
        description: template.desc,
        startTime,
        endTime,
        startTimeStr: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTimeStr: endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationMinutes: template.durationMinutes
      });

      currentMs = endMs;
      idx++;
    }

    this.cache.set(dayKey, schedule);
    return schedule;
  }

  getNowPlaying(channelId, now = new Date()) {
    const schedule = this.getChannelSchedule(channelId, now);
    const nowMs = now.getTime();

    const currentProgram = schedule.find((prog) => {
      const startMs = prog.startTime.getTime();
      const endMs = prog.endTime.getTime();
      return nowMs >= startMs && nowMs < endMs;
    }) || schedule[0];

    if (!currentProgram) return null;

    const startMs = currentProgram.startTime.getTime();
    const endMs = currentProgram.endTime.getTime();
    const totalDuration = endMs - startMs;
    const elapsed = Math.max(0, nowMs - startMs);
    const progressPercent = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    // Find next program
    const currentIndex = schedule.indexOf(currentProgram);
    const nextProgram = currentIndex >= 0 && currentIndex + 1 < schedule.length ? schedule[currentIndex + 1] : null;

    return {
      current: currentProgram,
      next: nextProgram,
      progressPercent
    };
  }
}

export const epgService = new EPGService();
