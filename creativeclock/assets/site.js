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

// 只提升 preload，不再调用 load()：load() 会中断刚发起的 play()，
// 在 Safari 上表现为「第一次点击没反应」。
const warmVideo = (video) => {
  if (!video || video.dataset.warmed === 'true') return;
  video.dataset.warmed = 'true';
  video.preload = 'auto';
};

const pauseOtherVideos = (activeVideo) => {
  videoPlayers.forEach((player) => {
    const video = player.querySelector('video');
    if (video && video !== activeVideo && !video.paused) video.pause();
  });
};

videoPlayers.forEach((player) => {
  const video = player.querySelector('video');
  const toggle = player.querySelector('.video-toggle');
  if (!video || !toggle) return;

  // 演示视频本身是无声的，静音可避免在 iOS 上抢占音频会话、打断用户正在听的音乐。
  video.muted = true;

  const title = video.getAttribute('aria-label') || '演示视频';

  // 预热只发生在用户表现出意图时（悬停 / 按下 / 键盘聚焦），
  // 而不是滚动到附近就预下载，避免一次拉满 7 个视频。
  ['pointerenter', 'pointerdown', 'focusin'].forEach((type) => {
    player.addEventListener(type, () => warmVideo(video), { once: true, passive: true });
  });

  const togglePlayback = () => {
    if (!video.paused) {
      video.pause();
      return;
    }

    pauseOtherVideos(video);
    warmVideo(video);
    player.classList.remove('has-error');
    player.classList.add('is-loading');

    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch((error) => {
        // 用户在缓冲期间又点了暂停 / 切到别的视频，属于正常中断
        if (error && error.name === 'AbortError') return;
        player.classList.remove('is-loading');
        player.classList.add('has-error');
      });
    }
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePlayback();
  });

  video.addEventListener('click', togglePlayback);
  video.addEventListener('play', () => {
    player.classList.remove('is-loading', 'has-error');
    player.classList.add('is-playing');
    toggle.setAttribute('aria-label', `暂停${title}`);
  });
  video.addEventListener('pause', () => {
    player.classList.remove('is-loading', 'is-playing');
    toggle.setAttribute('aria-label', `播放${title}`);
  });
  video.addEventListener('waiting', () => player.classList.add('is-loading'));
  video.addEventListener('playing', () => player.classList.remove('is-loading'));
  video.addEventListener('canplay', () => player.classList.remove('is-loading'));
  video.addEventListener('error', () => {
    player.classList.remove('is-loading', 'is-playing');
    player.classList.add('has-error');
  });
  video.addEventListener('ended', () => {
    player.classList.remove('is-playing', 'is-loading');
    toggle.setAttribute('aria-label', `播放${title}`);
    // 归零即可：poster 图本身就是第 0 帧（实测 SSIM 0.937，肉眼无差别），
    // 这里调 load() 只会白白重新请求一次视频。
    video.currentTime = 0;
  });
});

const videoVisibilityObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) entry.target.querySelector('video')?.pause();
  });
}, { threshold: 0.08 });

videoPlayers.forEach((player) => videoVisibilityObserver.observe(player));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseOtherVideos(null);
});
