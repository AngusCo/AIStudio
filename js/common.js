/**
 * Author: Hank Hsiao
 */

/**
 * OtherWindow 跨網域綁事件
 * demo: 取得上層 iframe 裝置翻轉角度
 * OtherWindow.on('deviceorientation', function(e) {....});
 */

var OtherWindow = (function (window) {
    var bindEvents = {}; // 儲存 event 的名稱及 handler 引用
    var isInIframe = window !== window.top; // 是否包在 iframe 中

    /**
     * 接收上層 iframe 傳入的 message
     */
    function messageHandler(e) {
        // 接到 message 要先判斷傳 eventObj 是什麼事件 (如: deviceorientation 或 devicemotion)
        // 並取得相對應的 handler 代入 postMessage 的 data
        bindEvents[e.data.type] && bindEvents[e.data.type](e.data);
    }

    /**
     * 綁定需要 cross domain 的裝置事件，相容一般裝置事件 (deviceorientation, devicemotion ...etc)
     * @param  {String} event 事件名稱要與 init(event) 相同
     * @param  {Function} handler
     */
    function on(event, handler) {
        // 被包在 iframe 綁事件方式
        if (isInIframe) {
            bindEvents[event] = handler;
            // 先註冊等一下要接收的 message handler
            // window.addEventListener('message', messageHandler, false);
            window.addEventListener('message', messageHandler, false);
            // postMessage 跟 window.top 說要綁定什麼事件
            window.top.postMessage({ bind: event }, '*');
            return;
        }
        window.addEventListener(event, handler, false); // 正常綁事件方式 包被在 iframe 裡這行會失效
    }

    /**
     * 移除需要 cross domain 的裝置事件
     * @param  {String} event 事件名稱
     * @param  {Function} handler
     */
    function off(event, handler) {
        window.removeEventListener(event, handler);
        delete bindEvents[event];
    }

    return {
        on: on,
        off: off,
    };
})(window);

var Inapp = (function (window) {
    var firstViewable = false;

    /**
     * 在自家 inapp 中確定可見後再執行 callback (若不在自家 inapp 則立刻執行)
     * @param  {Function} callback
     */
    function afterViewable(callback) {
        if (typeof mraid !== 'undefined') {
            if (mraid.isViewable()) {
                callback();
            } else {
                mraid.addEventListener(
                    'viewableChange',
                    function (e) {
                        if (!firstViewable && (e == 'true' || e == true)) {
                            firstViewable = true;
                            callback();
                        }
                    },
                    false
                );
            }
        } else {
            callback();
        }
    }

    /**
     * 前往指定的網址 (預設為另開分頁 autoRedirect = false)
     * @param {String} url 外連網址
     * @param {Boolean} autoRedirect [option] 是否自動轉址(預設為false) 另開分頁不可設定自動轉址
     */
    function goUrl(url, autoRedirect) {
        autoRedirect = autoRedirect || false;
        if (typeof mraid !== 'undefined') {
            // 在自家 inapp 開啟外連
            mraid.open(url);
        } else {
            // 在 web 開啟外連
            if (autoRedirect === true) {
                // 自動轉址外連 不能另開分頁 (會被封鎖彈窗)
                // 判斷是否被包在 iframe 中 (通常被包住表示已套用廣告SDK)
                if (window !== window.top) {
                    // 在 iframe 中
                    try {
                        window.top.location.href = url;
                    } catch (err) {
                        // iOS 12.4 以上不支持跨網域轉址 (domain 不同不可以，但 domain 同 subdomain 或 port 不同卻可以)
                        if (err.name === 'SecurityError') {
                            // 上層要去接 message event 確認 data 有沒有 explosion.redirect 有的話就取得 url 做 locatioin.href 轉址
                            window.top.postMessage(
                                {
                                    explosion: {
                                        redirect: url,
                                    },
                                },
                                '*'
                            );
                        }
                    }
                } else {
                    // 不在 iframe 中直接開頁面測
                    location.href = url;
                }
            } else {
                // 另開分頁
                window.open(url);
            }
        }
    }

    return {
        afterViewable: afterViewable,
        goUrl: goUrl,
    };
})(window);

// (已棄用) 找不到 gs 時，會建立測試用的 function 以方便開發。callback function 在 gs 事件完成才會執行
// 外連請呼叫 gsClickThrough()
var gs =
    gs ||
    function (s, category, callback) {
        console.log('gs:' + s, 'category:' + category);
        if (typeof callback === 'function') {
            callback();
        }
    };

/*
gsn 取代舊版 gs
===============================
參數說明：gsn() 需傳入 object
name: 事件名稱 規則請參考(https://docs.google.com/spreadsheets/d/1uZkLz698fSna426woZxKF8hndIug3rghPcBrZHJ9gNk/edit#gid=540109286)
category: 主要會用到 engagement | system | debug
    impression (gsn 不會用到, 因為模組建立會自動插入)
    click through (gsn 不會用到, 因為是使用 gsClickThrough)
    engagement (手動觸發, ex: 'slide 1')
    system (非手動觸發類, ex: 'auto slide 1')
    video (gsn 暫時不會用到。影片相關事件使用 vast 和 dspVideoTracker)
    debug (不給客戶看，但 developer 可以看)
callback: gsn 執行完成後會呼叫的 callback function
value: gsn 暫時不會用到。若有多個影片，此 value 填入影片的 index (從1開始) or id
*/
var gsn =
    gsn ||
    function (obj) {
        console.log('gsn:', obj);
        if (typeof obj.callback === 'function') {
            obj.callback();
        }
    };

// 找不到 gsClickThrough 時，會建立測試用的 function 以方便開發。
var gsClickThrough =
    gsClickThrough ||
    function (url, autoRedirect, msg) {
        gs(msg, 'clickthrough');
        setTimeout(function () {
            Inapp.goUrl(url, autoRedirect);
        }, 300);
    };

/**
 * [取得 URL 指定參數的值]
 * @param  {String} name 網址參數 name
 * @return {String}      網址參數 value
 */
var getUrlVar = function (name) {
    var getUrlVars = (function () {
        var vars = {},
            hash;
        var hashes = window.location.search
            .slice(window.location.search.indexOf('?') + 1)
            .split('&'); //改這寫法才不會取到#
        for (var i = 0, len = hashes.length; i < len; i++) {
            hash = hashes[i].split('=');
            vars[hash[0]] = hash[1];
        }
        return vars;
    })();
    return getUrlVars[name];
};

/**
 * intersectionObserver 的代理函式
 * @param  {null}     proxyEvent  AD2Event 事件傳入的物件參數的位置，介面一律填上null
 * @param  {Object}   dom         要偵測的 DOM 物件
 * @param  {Function} entranceFn  進場函式
 * @param  {Function} exitFn      出場函式
 * @param  {Function} exceptionFn 例外函式
 * @param  {Boolean}  isProxy     是否有透過代理
 */
var proxyIntersectionHandler = (function () {
    if (
        !('IntersectionObserver' in window) ||
        !('IntersectionObserverEntry' in window) ||
        !('intersectionRatio' in window.IntersectionObserverEntry.prototype)
    ) {
        if (getUrlVar('from') === 'native') {
            // AD2 iframe
            return function (
                proxyEvent,
                dom,
                entranceFn,
                exitFn,
                exceptionFn,
                isProxy
            ) {
                OtherWindow.on('AD2Event', function (AD2Event) {
                    intersectionHandler(
                        AD2Event,
                        dom,
                        entranceFn,
                        exitFn,
                        exceptionFn,
                        isProxy
                    );
                });
            };
        } else {
            // I can't use IntersectionObserver
            return function (
                proxyEvent,
                dom,
                entranceFn,
                exitFn,
                exceptionFn,
                isProxy
            ) {
                intersectionHandler(
                    null,
                    dom,
                    entranceFn,
                    exitFn,
                    exceptionFn,
                    isProxy
                );
            };
        }
    } else {
        return function (
            proxyEvent,
            dom,
            entranceFn,
            exitFn,
            exceptionFn,
            isProxy
        ) {
            // I can use IntersectionObserver
            intersectionHandler(
                null,
                dom,
                entranceFn,
                exitFn,
                exceptionFn,
                isProxy
            );
        };
    }
})();

/**
 * intersectionObserver: 處理瀏覽器視窗與目標DOM相交顯示範圍
 * @param  {null}     proxyEvent  AD2Event 事件傳入的物件參數的位置，介面一律填上null
 * @param  {Object}   dom         要偵測的 DOM 物件
 * @param  {Function} entranceFn  進場函式
 * @param  {Function} exitFn      出場函式
 * @param  {Function} exceptionFn 例外函式
 * @param  {Boolean}  isProxy     是否有透過代理
 */
var intersectionHandler = (function () {
    var entranceFn;
    var exitFn;
    var AD2EventHandler = {
        isProxytrue: function (AD2Event, dom, entranceFn, exitFn) {
            // console.log('isProxytrue');
            // in the nearly future, this method will be abandoned
            // 此處的 DOM 必須是'置頂切齊' iframe 的狀態
            var offsetTop = AD2Event.iframe.top;
            var ViewportHeight = AD2Event.window.height;
            var intersectionRange = dom.scrollHeight * 0.5;
            var threshold = [
                -intersectionRange,
                ViewportHeight - intersectionRange,
            ];
            if (offsetTop >= threshold[0] && offsetTop <= threshold[1]) {
                entranceFn();
            } else {
                exitFn();
            }
        },
        isProxyfalse: function (
            AD2Event,
            dom,
            entranceFn,
            exitFn,
            exceptionFn
        ) {
            // console.log('isProxyfalse');
            // not by proxy, classify as exception
            // in the nearly future, all use no proxy
            exceptionFn && exceptionFn();
        },
    };

    var intersectionCallback = function (entries) {
        entries.forEach(function (entry) {
            var visiblePct = Math.floor(entry.intersectionRatio * 100);
            if (visiblePct > 50) {
                entranceFn && entranceFn();
            } else {
                exitFn && exitFn();
            }
        });
    };

    var ObserverHandler = function (dom, fn1, fn2) {
        var i = 0;
        var observer;
        var observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: [],
        };
        entranceFn = fn1;
        exitFn = fn2;
        for (i = 0; i <= 1.0; i += 0.1) {
            observerOptions.threshold.push(i);
        }

        observer = new IntersectionObserver(
            intersectionCallback,
            observerOptions
        );
        observer.observe(dom);
    };

    if (
        !('IntersectionObserver' in window) ||
        !('IntersectionObserverEntry' in window) ||
        !('intersectionRatio' in window.IntersectionObserverEntry.prototype)
    ) {
        if (getUrlVar('from') === 'native') {
            // AD2 iframe
            return function (
                AD2Event,
                dom,
                entranceFn,
                exitFn,
                exceptionFn,
                isProxy
            ) {
                AD2EventHandler['isProxy' + isProxy](
                    AD2Event,
                    dom,
                    entranceFn,
                    exitFn,
                    exceptionFn
                );
            };
        } else {
            // I can't use IntersectionObserver & not Ad2 iframe
            return function (
                proxyEvent,
                dom,
                entranceFn,
                exitFn,
                exceptionFn,
                isProxy
            ) {
                exceptionFn && exceptionFn();
            };
        }
    } else {
        return function (
            proxyEvent,
            dom,
            entranceFn,
            exitFn,
            exceptionFn,
            isProxy
        ) {
            ObserverHandler(dom, entranceFn, exitFn);
        };
    }
})();
