//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

// 注意zepto是不写分号的，但是这个立即执行函数前面为什么要写一个分号呢？
// 其实是用来结束之前的语句，防止出错

; (function ($) {
  // 生成标志元素和回调函数的唯一id
  var _zid = 1,
    undefined,
    slice = Array.prototype.slice,
    isFunction = $.isFunction,
    isString = function (obj) { return typeof obj == 'string' },

    // 保存着应用程序中所有的handler
    /*
    {
      1: [
        {
          e: 'click', // 事件名称
          fn: function () {}, // 用户传入的回调函数
          i: 0, // 该对象在该数组中的索引
          ns: 'qianlongo', // 命名空间
          proxy: function () {}, // 真正给dom绑定事件时执行的事件处理程序， 为del或者fn
          sel: '.qianlongo', // 进行事件代理时传入的选择器
          del: function () {} // 事件代理函数
        },
        {
          e: 'click', // 事件名称
          fn: function () {}, // 用户传入的回调函数
          i: 1, // 该对象在该数组中的索引
          ns: 'qianlongo', // 命名空间
          proxy: function () {}, // 真正给dom绑定事件时执行的事件处理程序， 为del或者fn
          sel: '.qianlongo', // 进行事件代理时传入的选择器
          del: function () {} // 事件代理函数
        }
      ]
    }
    */

    handlers = {}, 
    specialEvents = {},
    focusinSupported = 'onfocusin' in window,

    // 用focus和blur来代替focusin和focusout事件()  http://www.runoob.com/jsref/event-onfocusin.html

    focus = { focus: 'focusin', blur: 'focusout' },

    // 用mouseover和mouseout分别模拟mouseenter和mouseleave事件

    hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  // 取元素的标识符，有就直接读取，没有的话，先设置后读取
  // 增加注释：不仅仅是给element添加标志，在proxy中还给函数添加标志

  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }

  // 根据给定的element、event等参数从handlers中查找handler，
  // 主要用于事件移除(remove)和主动触发事件(triggerHandler)

  function findHandlers(element, event, fn, selector) {
    // 解析event，从而得到事件名称和命名空间
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    // 读取添加在element身上的handler(数组)，并根据event等参数帅选
    return (handlers[zid(element)] || []).filter(function (handler) {
      return handler
        && (!event.e || handler.e == event.e) // 事件名需要相同
        && (!event.ns || matcher.test(handler.ns)) // 命名空间需要相同
        && (!fn || zid(handler.fn) === zid(fn)) // 回调函数需要相同（话说为什么通过zid()这个函数来判断呢？）
        && (!selector || handler.sel == selector) // 事件代理时选择器需要相同
    })
  }

  // 解析注册事件时的字符串，将事件名和命名空间分离出来分别赋值给e和ns
  // 并且命名空间做了一下默认排序
  // 'click.qianlongo' => {e: 'click', ns: 'qianlongo'}

  function parse(event) {
    var parts = ('' + event).split('.')
    return { e: parts[0], ns: parts.slice(1).sort().join(' ') }
  }
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  // 主要处理focus和blur事件不支持冒泡，在捕获阶段去完成

  function eventCapture(handler, captureSetting) {
    return handler.del &&
      (!focusinSupported && (handler.e in focus)) ||
      !!captureSetting
  }

  // 返回真正的绑定的事件名

  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }

  // 注册事件的关键函数
  // element   =>   要监听的元素
  // events    =>   要注册的事件列表
  // fn        =>   事件处理程序
  // data      =>   附加的数据对象
  // selector  =>   进行事件委托时实际要监听的元素的选择器
  // delegator =>   事件委托函数
  // capture   =>   事件捕获 or 非事件捕获

  function add(element, events, fn, data, selector, delegator, capture) {
    // 为每个元素的事件分配一个唯一的id,如果之前已经分配过则直接读取
    var id = zid(element), 
        set = (handlers[id] || (handlers[id] = []))

    events.split(/\s/).forEach(function (event) {
      // 如果是ready事件，就直接调用ready方法(这里的return貌似无法结束forEach循环吧)
      // 还有没有办法直接去trigger('ready')
      if (event == 'ready') return $(document).ready(fn)
      // 得到事件和命名空间分离的对象 'click.qianlongo' => {e: 'click', ns: 'qianlongo'}
      var handler = parse(event)
      // 将用户输入的回调函数挂载到handler上
      handler.fn = fn
      // 将用户传入的选择器挂载到handler上（事件代理有用）
      handler.sel = selector
      // 用mouseover和mouseout分别模拟mouseenter和mouseleave事件
      // https://github.com/qianlongo/zepto-analysis/issues/1
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function (e) {
        var related = e.relatedTarget
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del = delegator
      // 注意需要事件代理函数（经过一层处理过后的）和用户输入的回调函数优先使用事件代理函数
      var callback = delegator || fn
      // proxy是真正绑定的事件处理程序
      // 并且改写了事件对象event
      // 添加了一些方法和属性，最后调用用户传入的回调函数，如果该函数返回false，则认为需要阻止默认行为和阻止冒泡
      handler.proxy = function (e) {
        e = compatible(e)
        if (e.isImmediatePropagationStopped()) return
        e.data = data
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      // 将该次添加的handler在set中的索引赋值给i
      handler.i = set.length
      // 把handler保存起来,注意因为一个元素的同一个事件是可以添加多个事件处理程序的
      set.push(handler)
      // 最后当然是绑定事件
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  }

  // 删除事件，off等方法底层用的该方法

  function remove(element, events, fn, selector, capture) {
    // 得到添加事件的时候给元素添加的标志id
    var id = zid(element)
    // 循环遍历要移除的事件(所以我们用的时候，可以一次性移除多个事件)
      ; (events || '').split(/\s/).forEach(function (event) {
        // findHandlers返回的是符合条件的事件响应集合
        findHandlers(element, event, fn, selector).forEach(function (handler) {
          // [{}, {}, {}]每个元素添加的事件形如该结构
          // 删除存在handlers上的响应函数
          delete handlers[id][handler.i]
          // 真正删除绑定在element上的事件及其事件处理函数
          if ('removeEventListener' in element)
            element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
        })
      })
  }

  $.event = { add: add, remove: remove }

  // proxy类似于原生的bind函数，绑定fn到context上下文，使用方式有以下几种
  // 1. $.proxy(fn, context)
  // 2. $.proxy(fn, context, [additionalArguments...])
  // 3. $.proxy(context, property)
  // 4. $.proxy(context, property, [additionalArguments...])

  $.proxy = function (fn, context) {
    // 将第三个参数及其之后的参数封装到数组中
    var args = (2 in arguments) && slice.call(arguments, 2)
    // 对应用法1、2
    if (isFunction(fn)) { 
      // 将调用proxy函数时传入的第三个参数及其之后的参数与调用proxyFn时的参数合并
      var proxyFn = function () { return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      // 添加函数标志
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
      // 对应用法4
      if (args) {
        args.unshift(fn[context], fn)
        return $.proxy.apply(null, args)
      } else {
        // 对应用法3
        return $.proxy(fn[context], fn)
      }
    } else {
      throw new TypeError("expected function")
    }
  }

  // 未元素绑定事件，事件都绑定在元素身上，没有使用事件代理（不推荐使用）

  $.fn.bind = function (event, data, callback) {
    return this.on(event, data, callback)
  }

  // 移除bind绑定的事件

  $.fn.unbind = function (event, callback) {
    return this.off(event, callback)
  }

  // 给元素添加一个事件，并且该事件对应的处理程序只执行一次

  $.fn.one = function (event, selector, data, callback) {
    return this.on(event, selector, data, callback, 1)
  }

  var returnTrue = function () { return true },
    returnFalse = function () { return false },

    // 匹配大写字母A-Z开头/returnValue/layerX/layerY/webkitMovementX/webkitMovementY 用于createProxy(),过滤event对象的属性

    ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
    eventMethods = {
      preventDefault: 'isDefaultPrevented',
      stopImmediatePropagation: 'isImmediatePropagationStopped',
      stopPropagation: 'isPropagationStopped'
    }

  // 修正和扩展event对象
  // 其中event为代理的事件对象，所谓代理，其实是修改了原生的event对象，或添加属性方法
  // source为原生对象

  function compatible(event, source) {
    if (source || !event.isDefaultPrevented) {
      source || (source = event)
      // 重写事件对象上的preventDefault、stopImmediatePropagation、stopPropagation方法
      // 并往事件对象上扩展isDefaultPrevented、isImmediatePropagationStopped、isPropagationStopped方法
      $.each(eventMethods, function (name, predicate) {
        var sourceMethod = source[name]
        event[name] = function () {
          // 对应的preventDefault...方法被调用，则isPreventDefault赋值为返回true的函数
          this[predicate] = returnTrue
          return sourceMethod && sourceMethod.apply(source, arguments)
        }
        event[predicate] = returnFalse
      })

      try {
        event.timeStamp || (event.timeStamp = Date.now())
      } catch (ignored) { }

      // defaultPrevented为true表示已经调用了preventDefault(),阻止浏览器默认行为
      // returnValue(存在于ie中的事件对象中)，设置为false，取消浏览器默认行为
      if (source.defaultPrevented !== undefined ? source.defaultPrevented :
        'returnValue' in source ? source.returnValue === false :
          source.getPreventDefault && source.getPreventDefault())
        event.isDefaultPrevented = returnTrue
    }
    return event
  }

  // 创建事件代理对象
  // proxy存储原始的event
  // 并且将event上ignoreProperties之外的属性赋值到proxy上

  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }

  // 小范围事件绑定

  $.fn.delegate = function (selector, event, callback) {
    return this.on(event, selector, callback)
  }

  // 解除事件绑定

  $.fn.undelegate = function (selector, event, callback) {
    return this.off(event, selector, callback)
  }

  // 冒泡到document.body绑定事件

  $.fn.live = function (event, callback) {
    $(document.body).delegate(this.selector, event, callback)
    return this
  }

  // 解除绑定在document.body的事件

  $.fn.die = function (event, callback) {
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  // 添加事件前的参数处理，参数处理结束后交给add函数处理

  $.fn.on = function (event, selector, data, callback, one) {
    var autoRemove, delegator, $this = this
    // {click: callback, enter: callback},针对这种调用方式，分别再绑定
    // 既然循环调用on函数的话，还可以这样用 {'click enter': callback}
    if (event && !isString(event)) {
      $.each(event, function (type, fn) {
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }

    // 常见的使用方式
    /*
    
     // 这种我们使用的也许最多了
     on(type, function(e){ ... })

    // 可以预先添加数据data，然后在回调函数中使用e.data来使用添加的数据
    on(type, data, function(e){ ... })

    // 事件代理形式
    on(type, [selector], function(e){ ... })

    // 当然事件代理的形式也可以预先添加data
    on(type, [selector], data, function(e){ ... })

    // 当然也可以只让事件只有一次起效

    on(type, [selector], data, function (e) { ... }, true)

    */

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
    if (callback === undefined || data === false)
      callback = data, data = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function (_, element) {
      // 如果只绑定一次事件，那么先移除事件及其对应的事件处理程序，再执行一次事件处理函数
      if (one) autoRemove = function (e) {
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }
      // 如果传了选择器，那么需要进行事件代理操作
      if (selector) delegator = function (e) {
        // 这里用了closest函数，查找到最先符合selector条件的元素
        var evt, match = $(e.target).closest(selector, element).get(0)
        // 查找到的最近的符合selector条件的节点不能是element元素
        if (match && match !== element) {
          // 然后将match节点和element节点，扩展到事件对象上去
          evt = $.extend(createProxy(e), { currentTarget: match, liveFired: element })
          // 最后便是执行回调函数
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      add(element, event, callback, data, selector, delegator || autoRemove)
    })
  }

  // 移除事件

  $.fn.off = function (event, selector, callback) {
    var $this = this
    // {click: clickFn, mouseover: mouseoverFn}
    // 传入的是对象，循环遍历调用本身解除事件
    if (event && !isString(event)) {
      $.each(event, function (type, fn) {
        $this.off(type, selector, fn)
      })
      return $this
    }
    // ('click', fn)
    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse
    // 循环遍历删除绑定在元素身上的事件，如何解除，可以看remove
    return $this.each(function () {
      remove(this, event, callback, selector)
    })
  }

  // 在对象集合的元素身上触发指定的事件，比如(click事件)
  // 参数可以是一个字符串类型，也可以是由$.Event创建的事件对象
  // 如果给定了args参数，该参数会传递给事件处理程序

  $.fn.trigger = function (event, args) {
    // 对传入的event进行处理，如果是字符串或者纯对象，得到一个自己创建的事件对象
    // 如果传入的已经是个经过$.Event处理的对象，则放入compatible再次改造(其实就是添加了几个方法，和重写了几个方法)
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    // args传递给事件处理程序的参数
    event._args = args
    return this.each(function () {
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      // items in the collection might not be DOM elements
      // 触发dom事件
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      // 因为zepto对象内部的元素不一定是dom元素，此时直接触发回调函数
      else $(this).triggerHandler(event, args)
    })
  }

  // 类似于trigger，但是又有所不同，triggerHandler直接触发回调函数，所以不会有冒泡一说

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function (event, args) {
    var e, result
    this.each(function (i, element) {
      // 处理参数event
      e = createProxy(isString(event) ? $.Event(event) : event)
      // 传递给事件处理函数的参数
      e._args = args
      // 将事件对象的target指定为当前元素
      e.target = element
      // 查找岛当前元素身上注册的事件处理程序，然后逐个遍历
      $.each(findHandlers(element, event.type || event), function (i, handler) {
        // 执行注册事件时真正添加的事件处理程序
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }
  
    // 绑定以及触发事件的快件方式
    // 比如 $('li').click(() => {})

    // shortcut methods for `.bind(event, fn)` for each event type
    ; ('focusin focusout focus blur load resize scroll unload click dblclick ' +
      'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave ' +
      'change select keydown keypress keyup error').split(' ').forEach(function (event) {
        $.fn[event] = function (callback) {
          return (0 in arguments) ?
            this.bind(event, callback) :
            this.trigger(event)
        }
      })

  // 创建并初始化一个指定的dom事件对象
  // 如果给定了props，则将其扩展到事件对象上
  // 触发一个dom事件，需要3步
  // 1 创建一个事件对象 document.createEvent(event)
  // 2 初始化事件对象 event.initEvent(type, bubbles, true)
  // 3 分发事件  dom.dispatchEvent(event)

  $.Event = function (type, props) {
    // 当type是个对象时,比如{type: 'click', data: 'qianlongo'}
    if (!isString(type)) props = type, type = props.type
    // click,mousedown,mouseup mousemove对应MouseEvent
    // 其他事件对应为Events
    // 并把bubbles设置为true，表示事件冒泡，为false则不冒泡
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    // 当props存在的时候，对props进行循环处理，将其属性扩展到event对象上
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    // 初始化事件对象，第一个为事件类型，第二个为冒泡与否，第三个为是否可以通过preventDefault来阻止浏览器默认行为
    event.initEvent(type, bubbles, true)
    // 再对创造出来的时间对象处理一番并返回
    return compatible(event)
  }

})(Zepto)
