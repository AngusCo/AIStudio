/**
 *  explosion-avatar.js
 *
 *  Author : Angus Ko
 *  Require: observer.js
 *  
 *  使用瀏覽器 chrome 測試 https 環境
 *  chrome://flags/#unsafely-treat-insecure-origin-as-secure
 */
var Explosion = Explosion || {};

Explosion.Avatar = (function() {
    /**
     * deepCopy
     * @param  Function Parent
     * @param  Function Child
     */
    var deepCopy = function(p, c) {
        var c = c || {};
        for (var i in p) {
            if (typeof p[i] === 'object') {
                c[i] = (p[i].constructor === Array) ? [] : {};
                deepCopy(p[i], c[i]);
            } else {
                // 淺拷貝
                c[i] = p[i];
            }
        }
        c.uber = p;
        return c;
    };

    function Avatar(setting) {
        var defaultSetting = {
            streamMode: true        // 即時模式 or 拍照上傳模式
        };
        this.setting = deepCopy(setting, defaultSetting);
    }

    // observer.js
    Observer(Avatar.prototype);

    Avatar.prototype.init = function() {
        // 共用參數
        this.deviceIds;
        this.selectedDevice;
        this.currentStream;
        this.camera;
        this.canvas;
        this.displaySize;
        
        // 初始化 el
        this.el = document.querySelector(this.setting.el);
        var ratio = this.setting.mod.height / this.setting.mod.width;
        this.el.style.height = ratio * 100 + 'vw';

        this.startContainer = this.createStartImage();

        return this;
    };

    // 產生開始畫面
    Avatar.prototype.createStartImage = function() {
        var startContainer = document.createElement('div');
        this.el.appendChild(startContainer);
        startContainer.classList.add('start-container');

        var img = document.createElement('img');
        startContainer.appendChild(img);
        // img.src = this.setting.startImgSrc;
        img.src = '_images/start.gif';

        // 點擊後開啟攝影機
        startContainer.addEventListener('click', this.initCameraDevices.bind(this));
        return startContainer;
    };

    // 列出所有視訊輸入設備
    Avatar.prototype.initCameraDevices = function() {
        if (navigator.mediaDevices) {
            navigator.mediaDevices.enumerateDevices().then(function(devices) {
                if (this.getDevices(devices)) {
                    this.selectedDevice = this.deviceIds.length > 1 ? this.deviceIds[1] : this.deviceIds[0];
                    this.camera = this.createCamera();
                    this.createFlipBtn();
                    this.startCameraStream();
                }
            }.bind(this));
        }
    };

    Avatar.prototype.createFlipBtn = function() {
        var flipBtn = document.createElement('div');
        document.querySelector('.camera-container').appendChild(flipBtn);
        flipBtn.classList.add('flip-btn');

        var img = document.createElement('img');
        flipBtn.appendChild(img);
        img.src = 'images/flip-btn.png';

        flipBtn.addEventListener('click', this.handleFlipCamera.bind(this));
    };

    // 產生 video 元件
    Avatar.prototype.createCamera = function() {
        var cameraContainer = document.createElement('div');
        this.el.appendChild(cameraContainer);
        cameraContainer.classList.add('camera-container');

        var camera = document.createElement('video');
        cameraContainer.appendChild(camera);
        camera.playsInline = true;
        camera.muted = true;
        camera.autoplay = true;

        if (this.setting.mod.width > this.setting.mod.height) {
            cameraContainer.style.height = '100%';
            cameraContainer.style.left = '50%';
            cameraContainer.style.transform = 'translateX(-50%)';
            camera.style.height = '100%';
        }
        else {
            cameraContainer.style.width = '100%';
            cameraContainer.style.top = '50%';
            cameraContainer.style.transform = 'translateY(-50%)';
            camera.style.width = '100%';
        }

        return camera;
    };

    // 啟動即時串流
    Avatar.prototype.startCameraStream = function() {
        var _self = this;

        if (typeof this.currentStream !== 'undefined') {
            this.stopMediaTracks(currentStream);
        }

        var videoConstraints = {};
        if (this.selectedDevice === '') {
            videoConstraints.facingMode = 'user';
        }
        else {
            videoConstraints.deviceId = { exact: this.selectedDevice };
        }

        var constraints = {
            video: videoConstraints,
            audio: false
        }
        navigator.mediaDevices.getUserMedia(constraints)
            .then(function(stream) {
                console.log(stream.getTracks()[0].getSettings());
                _self.camera.srcObject = stream;
                _self.camera.addEventListener('loadedmetadata', function() {
                    _self.startContainer.style.display = 'none';
                    _self.displaySize = { width: _self.camera.scrollWidth, height: _self.camera.scrollHeight };
                    _self.initFaceDetection();
                });
                // return navigator.mediaDevices.enumerateDevices();
            })
            // .then(_self.getDevices)
            .catch(function(err) {
                console.log(err);
            });
    };

    Avatar.prototype.getDevices = function(mediaDevices) {
        this.deviceIds = [];
        var count = 0;
        mediaDevices.forEach(function(mediaDevice) {
            if (mediaDevice.kind === 'videoinput') {
                this.deviceIds.push(mediaDevice.deviceId);
                count++;
            }
        }, this);

        return (count > 0);
    };

    Avatar.prototype.stopMediaTracks = function(stream) {
        if (typeof stream !== 'undefined') {
            stream.getTracks().forEach(function(track) {
                track.stop();
            });
        }
    };

    Avatar.prototype.initFaceDetection = function() {
        var _self = this;
        var modelPath = './js/models';

        Promise.all([
            faceapi.nets.tinyFaceDetector.load(modelPath),
            faceapi.nets.faceLandmark68TinyNet.load(modelPath)
        ]).then(function(){
            _self.createCanvas();
            _self.startDetection();
        });
    };

    Avatar.prototype.createCanvas = function() {
        if (document.getElementsByTagName('canvas').length == 0) {
            this.canvas = faceapi.createCanvasFromMedia(this.camera);
            document.querySelector('.camera-container').appendChild(this.canvas);
            faceapi.matchDimensions(this.canvas, this.displaySize);
        }
    };

    Avatar.prototype.startDetection = function() {
        this.detectionLoop = setInterval(async function() {
            var detections = await faceapi
                .detectAllFaces(this.camera, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks(true);

            this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);

            var resizedDetections = faceapi.resizeResults(detections, this.displaySize);
            faceapi.draw.drawDetections(this.canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(this.canvas, resizedDetections);

        }.bind(this), 300);
    };

    Avatar.prototype.handleFlipCamera = function() {
        this.deviceIds.every(function(deviceId) {
            if (deviceId != this.selectedDevice) {
                this.selectedDevice = deviceId;
                this.startCameraStream()
                return false;
            }
            else {
                return true;
            }
        }, this);
    };

    return Avatar;
})();