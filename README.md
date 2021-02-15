# bg_camera

## Overview

HTML5 ベースの技術だけで脈拍計を実現したサンプルアプリケーション


## Technical Details

カメラに指の腹を押し付けるように撮影することで、脈拍による明るさの変化を検知できるようになる。

定期的に明るさの変化をモニターして脈拍が打った（と判断された）回数をカウントし、１分あたりの脈拍数を求めて表示する。


## Codes

- bg_camera.js

  - JavaScript の本体、 index.html からロードされる。

- index.html

  - 脈拍計画面。
  
  - bg_camera.js をロードして動かすには HTML 内に以下の要素が必要：

    - `#bpm-value` : 脈拍数を表示する &lt;output&gt; 要素

    - `#camera-feed` : カメラ内容を表示する &lt;video&gt; 要素

    - `#sampling-canvas` : カメラ内容を表示する 400 x 400 の &lt;canvas&gt; 要素

    - `#graph-canvas` : グラフ表示用の の &lt;canvas&gt; 要素

    - `#bpm-display-container` : モニタリングの実行／停止をトグルする要素

      - この要素は必須ではないが、用意しない場合は別途 `bg_camera.toggleMonitoring()` を実行するための仕組み（例えば xx キーを押した場合、など）を用意する必要がある。


## License

This code is licensed under MIT.

## Copyright

2021 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
