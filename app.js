const experience = document.querySelector('#experience');
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#world');
const lighting = document.querySelector('.lighting');
const views = document.querySelector('.views');
const reset = document.querySelector('#reset');
const status = document.querySelector('#scene-status');
const statusText = document.querySelector('#status-text');
const retry = document.querySelector('#retry');
const guide = document.querySelector('#guide');
const fullscreen = document.querySelector('#fullscreen');

document.querySelector('#open-guide').addEventListener('click', () => guide.showModal());
retry.addEventListener('click', () => location.reload());

fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await experience.requestFullscreen();
  } catch {
    fullscreen.hidden = !document.fullscreenEnabled;
  }
});
document.addEventListener('fullscreenchange', () => {
  const active = document.fullscreenElement === experience;
  const label = active ? '退出全屏' : '进入全屏';
  fullscreen.title = label;
  fullscreen.setAttribute('aria-label', label);
  fullscreen.querySelector('use').setAttribute('href', active ? '#i-compress' : '#i-expand');
});

function showError(message) {
  status.hidden = false;
  status.dataset.error = '';
  statusText.textContent = message;
  retry.hidden = false;
  lighting.inert = views.inert = true;
  reset.disabled = true;
}

const cameraKeys = {
  ArrowLeft: { azimuth: -0.15 },
  ArrowRight: { azimuth: 0.15 },
  ArrowUp: { altitude: -0.10 },
  ArrowDown: { altitude: 0.10 },
  '+': { scale: 0.86 },
  '=': { scale: 0.86 },
  '-': { scale: 1.17 },
};

async function start() {
  if (typeof WebGL2RenderingContext === 'undefined') {
    showError('此浏览器无法开启 WebGL 2。请开启硬件加速后重新载入。');
    return;
  }

  try {
    const { createWorld } = await import('./scene/world.js');
    const world = createWorld(canvas, {
      onContextLost: () => showError('三维渲染已中断，请重新载入场景。'),
    });

    const viewButtons = [...views.querySelectorAll('[data-view]')];
    function markView(name) {
      stage.dataset.view = name;
      for (const item of viewButtons) item.setAttribute('aria-pressed', String(item.dataset.view === name));
    }

    function selectView(name) {
      world.setView(name);
      markView(name);
    }

    for (const button of viewButtons) button.addEventListener('click', () => selectView(button.dataset.view));
    reset.addEventListener('click', () => selectView('overview'));

    const timeButtons = [...lighting.querySelectorAll('[data-time]')];
    for (const button of timeButtons) {
      button.addEventListener('click', () => {
        world.setNight(button.dataset.time === 'night');
        for (const item of timeButtons) item.setAttribute('aria-pressed', String(item === button));
      });
    }

    for (const button of lighting.querySelectorAll('[data-light]')) {
      button.addEventListener('click', () => {
        const enabled = button.getAttribute('aria-checked') !== 'true';
        world.setLight(button.dataset.light, enabled);
        button.setAttribute('aria-checked', String(enabled));
      });
    }

    canvas.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Home') selectView('overview');
      else if (Object.hasOwn(cameraKeys, event.key)) {
        world.moveCamera(cameraKeys[event.key]);
        markView('custom');
      }
      else return;
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (event.buttons === 1 && stage.dataset.view !== 'custom') markView('custom');
    });
    canvas.addEventListener('wheel', () => {
      if (stage.dataset.view !== 'custom') markView('custom');
    }, { passive: true });

    status.hidden = true;
    lighting.inert = views.inert = false;
    reset.disabled = false;
  } catch (error) {
    console.error('Willowbrook scene initialization failed', error);
    showError(String(error?.message).includes('WebGL context')
      ? '此浏览器无法开启 WebGL 2。请开启硬件加速后重新载入。'
      : '场景载入失败，请重新载入。');
  }
}

start();
