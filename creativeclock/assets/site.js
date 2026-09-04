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

const warmVideo = (video) => {
  if (!video || video.dataset.warmed === 'true') return;
  video.dataset.warmed = 'true';
  video.preload = 'auto';
  video.load();
};

const firstVideo = videoPlayers[0]?.querySelector('video');
if (firstVideo) {
  firstVideo.dataset.warmed = 'true';
}

const videoWarmupObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    warmVideo(entry.target.querySelector('video'));
    videoWarmupObserver.unobserve(entry.target);
  });
}, { rootMargin: '360px 0px', threshold: 0 });

videoPlayers.slice(1).forEach((player) => videoWarmupObserver.observe(player));

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

  const title = video.getAttribute('aria-label') || '演示视频';

  const togglePlayback = async () => {
    if (!video.paused) {
      video.pause();
      return;
    }

    pauseOtherVideos(video);
    warmVideo(video);
    player.classList.add('is-loading');
    try {
      await video.play();
    } catch (_error) {
      player.classList.remove('is-loading');
    }
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePlayback();
  });

  video.addEventListener('click', togglePlayback);
  video.addEventListener('play', () => {
    player.classList.remove('is-loading');
    player.classList.add('is-playing');
    toggle.setAttribute('aria-label', `暂停${title}`);
  });
  video.addEventListener('pause', () => {
    player.classList.remove('is-loading');
    player.classList.remove('is-playing');
    toggle.setAttribute('aria-label', `播放${title}`);
  });
  video.addEventListener('waiting', () => player.classList.add('is-loading'));
  video.addEventListener('canplay', () => player.classList.remove('is-loading'));
  video.addEventListener('ended', () => {
    video.currentTime = 0;
    player.classList.remove('is-playing');
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
