# 溪畔小屋 · Willowbrook

一个使用 Three.js 构建的交互式森林场景。建筑、植被、溪床和院落道具由程序化三维几何构成。字体和运行库随站点提供。

## 本地运行

在本目录启动 HTTP 静态服务。

```powershell
python -m http.server 4176 --bind 127.0.0.1 --directory dist
```

在支持 WebGL 2 的浏览器打开 [本地场景](http://127.0.0.1:4176/)。

## 操作

- 拖动画面旋转，滚轮或双指捏合缩放。聚焦场景后，可用方向键、加减号和 Home 键操作镜头。
- 底栏提供全景、小屋、木亭和溪流四个视角。
- 照明面板可切换黄昏和夜间，房屋灯光和桌上油灯各有独立开关。

## 源码

- `dist/app.js` 连接浏览器界面和场景。
- `dist/scene/world.js` 管理镜头、气氛、照明和渲染。
- `dist/scene/cottage.js`、`pavilion.js` 和 `grounds.js` 分别构建小屋、木亭以及溪流和森林。
