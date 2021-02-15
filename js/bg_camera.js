//. bg_camera.js
var bg_camera = (function(){
  var IMAGE_WIDTH = 30;
  var IMAGE_HEIGHT = 30;
  var SAMPLE_BUFFER = [];
  var MAX_SAMPLES = 60 * 5; //. 60 samples per second * max 5 seconds
  var START_DELAY = 1500;

  var ON_BPM_CHANGE = null;
  var VIDEO_ELEMENT = null;  
  var SAMPLING_CANVAS = null;  
  var SAMPLING_CONTEXT = null;  
  var GRAPH_CANVAS = null;  
  var GRAPH_CONTEXT = null;  
  var GRAPH_COLOR = null;  
  var GRAPH_WIDTH = null;  

  var DEBUG = false;  
  var VIDEO_STREAM = null;  
  var MONITORING = false;  

  var public = {};

  //. 指定したキャンバス内のピクセル単位での平均輝度を計算
  function averageBrightness( canvas, context ){
    var pixelData = context.getImageData(
      0, 0, canvas.width, canvas.height
    ).data;
    var sum = 0;

    for( var i = 0; i < pixelData.length; i += 4 ){
      //. Only Red & Green Channel => Best Reading らしい・・
      sum += pixelData[i] + pixelData[i+1];
    }

    var avg = sum / ( pixelData.length * 0.5 );

    return avg / 255;  //. scale to 0..1
  };

  public.initialize = function( configuration ){
    VIDEO_ELEMENT = configuration.videoElement;
    SAMPLING_CANVAS = configuration.samplingCanvas;
    GRAPH_CANVAS = configuration.graphCanvas;
    GRAPH_COLOR = configuration.graphColor;
    GRAPH_WIDTH = configuration.graphWidth;
    ON_BPM_CHANGE = configuration.onBpmChange;
    SAMPLING_CONTEXT = SAMPLING_CANVAS.getContext( '2d' );
    GRAPH_CONTEXT = GRAPH_CANVAS.getContext( '2d' );

    if( !"mediaDevices" in navigator ){
      alert( "Sorry, your browser doesn't support camera access." );
      return false;
    }

    window.addEventListener( "resize", handleResize );

    handleResize();
  };

  //. グラフの描画領域をクライアントサイズから取得
  function handleResize(){
    GRAPH_CANVAS.width = GRAPH_CANVAS.clientWidth;
    GRAPH_CANVAS.height = GRAPH_CANVAS.clientHeight;
  };

  //. 計測するかしないかのトグル処理
  public.toggleMonitoring = function(){
    MONITORING ? stopMonitoring() : startMonitoring();
  };

  //. 動画撮影可能なカメラデバイスの取得
  async function getCamera(){
    var devices = await navigator.mediaDevices.enumerateDevices();
    var cameras = devices.filter(
      function( device ){
        return ( device.kind === "videoinput" );
      }
    );

    return cameras[cameras.length-1];
  }

  //. 撮影（＝モニタリング）開始
  async function startMonitoring(){
    resetBuffer();
    handleResize();
    setBpmDisplay( "" );

    //. カメラ取得
    var camera = await getCamera();

    //. カメラストリームの取得
    VIDEO_STREAM = await startCameraStream( camera );
    if( !VIDEO_STREAM ){
      throw Error( 'Unable to start video stream' );
    }

    //. トーチON (?)
    try{
      setTorchStatus( VIDEO_STREAM, true );
    }catch( e ){
      alert( "Error: " + e );
    }

    //. カメラで撮影した映像を <video> で再生
    SAMPLING_CANVAS.width = IMAGE_WIDTH;
    SAMPLING_CANVAS.height = IMAGE_HEIGHT;
    VIDEO_ELEMENT.srcObject = VIDEO_STREAM;
    VIDEO_ELEMENT.play();
    MONITORING = true;

    //. ディレイをかけてからモニターループ開始
    setTimeout( async function(){
      monitorLoop();
    }, START_DELAY );
  };

  //. 撮影（＝モニタリング）終了
  async function stopMonitoring(){
    setTorchStatus( VIDEO_STREAM, false );
    VIDEO_ELEMENT.pause();
    VIDEO_ELEMENT.srcObject = null;
    MONITORING = false;
  };

  //. モニターループ
  function monitorLoop(){
    //. ある瞬間の状況を処理
    processFrame();
    if( MONITORING ){
      //. モニタリング中はループ処理を続ける
      window.requestAnimationFrame( monitorLoop );
    }
  };

  //. バッファリセット
  function resetBuffer(){
    SAMPLE_BUFFER.length = 0;
  };

  //. カメラ映像のストリームを開始する
  async function startCameraStream( camera ){
    var stream = null;
    try{
      //. カメラストリームを取得
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: camera.deviceId,
          facingMode: [ "User", "environment" ],
          width: { ideal: IMAGE_WIDTH },
          height: { ideal: IMAGE_HEIGHT },

          whiteBalanceMode: "manual",
          exposureMode: "manual",
          focusMode: "manual"
        }
      });
    }catch( err ){
      alert( "Failed to access camera! : " + err );
      return;
    }

    return stream;
  };

  async function setTorchStatus( stream, status ){
    try{
      var track = stream.getVideoTracks()[0];
      await track.applyConstraints({ advanced: [{ torch: status }] });
    }catch( err ){
      alert( "Starting torch failed! : " + err );
      return;
    }
  };

  function setBpmDisplay( bpm ){
    ON_BPM_CHANGE( bpm );
  };

  function processFrame(){
    //. 動画の内容を Canvas に描画
    SAMPLING_CONTEXT.drawImage(
      VIDEO_ELEMENT, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT 
    );

    //. キャンバス内の平均明るさを取得
    var value = averageBrightness( SAMPLING_CANVAS, SAMPLING_CONTEXT );
    var time = Date.now();
    SAMPLE_BUFFER.push( { value, time } );
    if( SAMPLE_BUFFER.length > MAX_SAMPLES ){
      SAMPLE_BUFFER.shift();
    }

    //. 明るさの推移を分析
    var dataStats = analyzeData( SAMPLE_BUFFER );
    //. BPM を計算
    var bpm = calculateBpm( dataStats.crossings );
    if( bpm ){
      //. BPM を描画
      setBpmDisplay( Math.round( bpm ) );
    }

    //. 分析結果をグラフに描画
    drawGraph( dataStats );
  };

  function analyzeData( samples ){
    //. 明るさの平均値を取得
    var average = samples.map( (sample) => sample.value ).reduce( (a,c) => a + c ) / samples.length;

    //. 明るさの最大値・最小値を取得
    var min = samples[0].value;
    var max = samples[0].value;
    samples.forEach( function( sample ){
      if( sample.value > max ){
        max = sample.value;
      }
      if( sample.value < min ){
        min = sample.value;
      }
    });
    //. 明るさの変化幅を計算
    var range = max - min;

    //. 平均値を横切った瞬間のサンプルを取り出す
    const crossings = getAverageCrossings( samples, average );

    return {
      average,
      min,
      max,
      range,
      crossings
    };
  };

  //. 平均値 average を横切った瞬間のサンプルを取り出す
  function getAverageCrossings( samples, average ){
    var crossingsSamples = [];
    var previousSample = samples[0];

    samples.forEach( function( currentSample ){
      if( currentSample.value < average && previousSample.value > average ){
        crossingsSamples.push( currentSample );
      }
      previousSample = currentSample;
    });

    return crossingsSamples;
  };

  function calculateBpm( samples ){
    if( samples.length < 2 ){
      return;
    }

    var averageInterval = ( samples[samples.length-1].time - samples[0].time ) / ( samples.length - 1 );
    return 60000 / averageInterval;
  };

  function drawGraph( dataStats ){
    var xScaling = GRAPH_CANVAS.width / MAX_SAMPLES;
    var xOffset = ( MAX_SAMPLES - SAMPLE_BUFFER.length ) * xScaling;

    GRAPH_CONTEXT.lineWidth = GRAPH_WIDTH;
    GRAPH_CONTEXT.strokeStyle = GRAPH_COLOR;
    GRAPH_CONTEXT.lineCap = "round";
    GRAPH_CONTEXT.lineJoin = "round";

    GRAPH_CONTEXT.clearRect( 0, 0, GRAPH_CANVAS.width, GRAPH_CANVAS.height );
    GRAPH_CONTEXT.beginPath();

    var maxHeight = GRAPH_CANVAS.height - GRAPH_CONTEXT.lineWidth * 2;
    var previousY = 0;
    SAMPLE_BUFFER.forEach( function( sample, i ){
      var x = xScaling * i + xOffset;
      var y = GRAPH_CONTEXT.lineWidth;
      if( sample.value != 0 ){
        y = ( maxHeight * ( sample.value - dataStats.min ) ) / ( dataStats.max - dataStats.min ) + GRAPH_CONTEXT.lineWidth;
      }
      if( y != previousY ){
        GRAPH_CONTEXT.lineTo( x, y );
      }

      previousY = y;
    });

    GRAPH_CONTEXT.stroke();
  };

  return public;
})();

