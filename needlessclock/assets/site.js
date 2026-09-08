const header = document.querySelector('.site-header');

const updateHeader = () => {
  header?.classList.toggle('scrolled', window.scrollY > 18);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const videoPlayers = [...document.querySelectorAll('[data-video-player]')];

// 缓冲够了再播，最多等这么久；到点就按现有缓冲开播。
const PREBUFFER_TIMEOUT = 25000;
// 网速够快时只需缓冲这么多秒就开播。
const MIN_PREBUFFER = 2;
// 网速不够时最多缓冲到时长的这个比例，避免无限等待。
const MAX_PREBUFFER_RATIO = 0.6;

// 首屏那张海报由 HTML 直接加载，其余 6 张滚动到附近再加载。
// 原来 7 张海报共 780KB 会在首屏一起下，抢走视频的带宽。
const posterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const video = entry.target.querySelector('video');
    if (video?.dataset.poster) {
      video.poster = video.dataset.poster;
      delete video.dataset.poster;
    }
    posterObserver.unobserve(entry.target);
  });
}, { rootMargin: '300px 0px', threshold: 0 });

// 只提升 preload，不调用 load()：load() 会中断刚发起的 play()。
const warmVideo = (video) => {
  if (!video || video.dataset.warmed === 'true') return;
  video.dataset.warmed = 'true';
  video.preload = 'auto';
};

const pauseOtherVideos = (activeVideo) => {
  videoPlayers.forEach((player) => {
    const video = player.querySelector('video');
    if (video && video !== activeVideo) {
      player.cancelBuffering?.();
      if (!video.paused) video.pause();
    }
  });
};

videoPlayers.forEach((player) => {
  const video = player.querySelector('video');
  const toggle = player.querySelector('.video-toggle');
  if (!video || !toggle) return;

  // 演示视频本身无声，静音可避免在 iOS 上抢占音频会话打断用户的音乐，
  // 同时也让「缓冲够了再自动开播」不受自动播放策略限制。
  video.muted = true;

  const title = video.getAttribute('aria-label') || '演示视频';
  let buffering = null;

  const bufferedAhead = () => {
    for (let i = 0; i < video.buffered.length; i += 1) {
      if (video.buffered.start(i) <= video.currentTime + 0.1 && video.buffered.end(i) > video.currentTime) {
        return video.buffered.end(i) - video.currentTime;
      }
    }
    return 0;
  };

  // 按实测缓冲速度决定要预缓冲多少：
  //   fillRate = 每 1 秒墙上时间能缓冲进来多少秒视频
  //   fillRate >= 1  → 下载比播放快，缓冲 2 秒就能一路播完，不用等
  //   fillRate <  1  → 播放会追上下载，需要预缓冲 时长x(1-fillRate) 才不卡
  const bufferTarget = () => {
    const total = video.duration;
    if (!Number.isFinite(total) || total <= 0) return Infinity;
    const cap = Math.min(total, total * MAX_PREBUFFER_RATIO);
    if (!buffering) return Math.min(cap, MIN_PREBUFFER);

    // 用最近 2 秒的滑动窗口测速：刚开始的瞬时速率会被 TCP 初始窗口和
    // preload=metadata 已下的数据抬高，直接用「总量/总时间」会高估网速而过早开播。
    const win = buffering.samples;
    if (win.length < 10) return cap;                     // 不足 2.5 秒采样，先按最保守值等
    const oldest = win[0];
    const newest = win[win.length - 1];
    const dt = (newest.t - oldest.t) / 1000;
    if (dt <= 0) return cap;
    const fillRate = (newest.b - oldest.b) / dt;
    if (fillRate >= 1.05) return Math.min(cap, MIN_PREBUFFER);
    const needed = total * (1 - fillRate) * 1.15;        // 15% 余量
    return Math.max(MIN_PREBUFFER, Math.min(cap, needed));
  };

  const showProgress = () => {
    const target = bufferTarget();
    if (!Number.isFinite(target)) {
      player.dataset.progress = '缓冲中…';
      return;
    }
    const pct = Math.min(100, Math.round((bufferedAhead() / target) * 100));
    player.dataset.progress = `缓冲 ${pct}%`;
  };

  const enoughBuffered = () => bufferedAhead() >= bufferTarget();

  const cancelBuffering = () => {
    if (!buffering) return;
    clearTimeout(buffering.timer);
    clearInterval(buffering.tick);
    video.removeEventListener('canplaythrough', buffering.onReady);
    buffering = null;
    player.classList.remove('is-buffering', 'is-loading');
    delete player.dataset.progress;
  };
  player.cancelBuffering = cancelBuffering;

  const reallyPlay = () => {
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch((error) => {
        if (error && error.name === 'AbortError') return;
        player.classList.remove('is-loading');
        player.classList.add('has-error');
      });
    }
  };

  const togglePlayback = () => {
    if (buffering) { cancelBuffering(); return; }   // 缓冲中再点一次 = 取消
    if (!video.paused) { video.pause(); return; }

    pauseOtherVideos(video);
    warmVideo(video);
    player.classList.remove('has-error');
    player.classList.add('is-loading');

    // 先在用户手势内发起一次 play()：既保留手势授权，也让浏览器立刻开始下载。
    const kick = video.play();
    if (kick && typeof kick.catch === 'function') kick.catch(() => {});

    // HAVE_ENOUGH_DATA：浏览器认为能一口气播完，直接放。
    if (video.readyState >= 4) return;

    startBuffering();
  };

  function startBuffering() {
    if (buffering) return;
    // 先暂停，攒够缓冲再开播 —— 慢网下这比边下边卡体验好得多。
    video.pause();
    player.classList.add('is-buffering');
    showProgress();

    const onReady = () => { if (enoughBuffered()) finish(); };
    const finish = () => {
      if (!buffering) return;
      clearTimeout(buffering.timer);
      clearInterval(buffering.tick);
      video.removeEventListener('canplaythrough', onReady);
      buffering = null;
      player.classList.remove('is-buffering');
      delete player.dataset.progress;
      reallyPlay();
    };

    buffering = {
      startedAt: Date.now(),
      samples: [],
      onReady,
      timer: setTimeout(finish, PREBUFFER_TIMEOUT),
      tick: setInterval(() => {
        buffering.samples.push({ t: Date.now(), b: bufferedAhead() });
        while (buffering.samples.length > 1 && Date.now() - buffering.samples[0].t > 2000) {
          buffering.samples.shift();
        }
        showProgress();
        if (enoughBuffered()) finish();
      }, 250),
    };
    video.addEventListener('canplaythrough', onReady);
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePlayback();
  });

  video.addEventListener('click', togglePlayback);
  video.addEventListener('play', () => {
    if (buffering) return;
    player.classList.remove('is-loading', 'has-error');
    player.classList.add('is-playing');
    toggle.setAttribute('aria-label', `暂停${title}`);
  });
  video.addEventListener('pause', () => {
    if (buffering) return;   // 缓冲阶段的 pause 不算用户暂停
    player.classList.remove('is-loading', 'is-playing');
    toggle.setAttribute('aria-label', `播放${title}`);
  });
  video.addEventListener('waiting', () => {
    if (buffering) return;
    player.classList.add('is-loading');
    // 已经开播却又缺数据，说明预估的网速偏乐观。退回缓冲阶段重新攒够再播，
    // 让用户看到「缓冲 x%」，而不是画面一卡一卡。
    if (!video.paused && video.currentTime > 0) startBuffering();
  });
  video.addEventListener('playing', () => { if (!buffering) player.classList.remove('is-loading'); });
  video.addEventListener('error', () => {
    cancelBuffering();
    player.classList.remove('is-loading', 'is-playing');
    player.classList.add('has-error');
  });
  video.addEventListener('ended', () => {
    player.classList.remove('is-playing', 'is-loading');
    toggle.setAttribute('aria-label', `播放${title}`);
    // 归零即可：poster 就是第 0 帧（实测 SSIM 0.937），调 load() 只会白白重新请求。
    video.currentTime = 0;
  });

  if (video.dataset.poster) posterObserver.observe(player);

  // 预热只在用户表现出意图时发生，而不是滚动到附近就预下载。
  ['pointerenter', 'pointerdown', 'focusin'].forEach((type) => {
    player.addEventListener(type, () => warmVideo(video), { once: true, passive: true });
  });
});

const videoVisibilityObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) return;
    entry.target.cancelBuffering?.();
    entry.target.querySelector('video')?.pause();
  });
}, { threshold: 0.08 });

videoPlayers.forEach((player) => videoVisibilityObserver.observe(player));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseOtherVideos(null);
});
