;(function($) {
  window.convos = window.convos || {}

  var socket;
  var connect = function() {
    var socket_url = $('body').attr('data-socket-url');
    socket = new ReconnectingWebSocket({ url: socket_url, ping_protocol: [ 'PING', 'PONG' ] });
    socket.onmessage = receiveMessage;
    socket.onpong = function(e) { convos.input.attr('placeholder', 'What\'s on your mind ' + convos.current.nick + '?'); };
    socket.onclose = function() { convos.input.addClass('disabled'); };
    socket.onopen = function(e) {
      convos.input.removeClass('disabled');
      if (e.reconnected && !$('li.message').eq(-1).hasClass('error')) $.pjax({ url: location.href, container: 'div.messages', fragment: 'div.messages'});
    };
    convos.send.socket = socket;
  };

  var addPendingMessage = function(message, attr) {
    var $pending = $('<li><h3>' + convos.current.nick + '</h3><div class="content">' + message + '</div></li>').attr(attr);
    $pending.addClass('message pending').addToMessages();
    setTimeout(function() { messageFailed(attr['id']); }, 10000);
  };

  var messageFailed = function(id, description) {
    var $pending = $('#' + id);
    var $actions = $('<span class="actions"><button>Resend</button> <button>&times;</button></span>');

    $actions.find('button:first').on('click', function() {
      socket.buffer = []; // need to clear buffer when resending messages
      convos.send($(this).parents('li').find('.content').text());
      $(this).closest('li').remove();
    });
    $actions.find('button:last').on('click', function() {
      $(this).closest('li').remove();
    });

    $pending.addClass('error').removeClass('hidden pending');
    $pending.prepend($actions);
  };

  var receiveHighlightMessage = function($message, to_current) {
    var body = $message.find('.content').text() || '...';
    var icon = $message.find('img').attr('src') || $.url_for('/images/icon-48.png');
    var sender = $message.data('sender');
    var what = /^[#&]/.test($message.data('target')) ? 'mentioned you in ' + $message.data('target') : 'sent you a message';
    var notified = $.notify([sender, what].join(' '), body, icon);

    // Mark message as read if $message is sent to current conversation
    $.get($.url_for('/chat/notifications'), $.noCache({ nid: !notified && to_current ? 0 : '' }), function(data) {
      var $data = $(data);
      $('nav a.notifications b').text($data.find('ul').data('notifications') || '');
      $('.notification-list ul').html($data.find('li'));
    });
  };

  var receiveMessage = function(e) {
    var $message = $(e.data);
    var url = $.url_for($message.attr('data-network'), encodeURIComponent($message.attr('data-target')));
    var to_current = toCurrent($message);

    if ($message.hasClass('error')) {
      messageFailed($message.attr('id'));
    }
    else {
      $('#' + $message.attr('id')).remove();
    }

    if ($message.hasClass('highlight')) {
      receiveHighlightMessage($message, to_current);
    }

    if ($message.hasClass('remove-conversation')) {
      $('nav ul.conversations a').slice(1).each(function() {
        if(this.href.indexOf(url) >= 0) return;
        $(this).click();
        return false;
      });
    }
    else if ($message.hasClass('add-conversation')) {
      $.pjax({ url: url, container: 'div.messages', fragment: 'div.messages'})
    }
    else if (to_current) {
      $message.addToMessages();
    }
    else if ($message.hasClass('message')) {
      var $unread = $('nav ul.conversations').find('a[href="' + url + '"]').children('b');
      $unread.text(parseInt($unread.html() || 0) + 1);
    }

    if (convos.at_bottom) $(window).scrollTo('bottom');
  };

  var toCurrent = function($e) {
    if ($e.data('network') == convos.current.network && $e.data('target') == convos.current.target) return true;
    if ($e.data('network') == convos.current.network && $e.data('target') == '') return true;
    if ($e.data('network') == '' && $e.data('target') == '') return true;
    return false;
  };

  convos.send = function(message, attr) {
    if (!socket) connect();
    if (message.length == 0) return socket.send('PING');

    attr = attr || {};
    attr['class'] = message.match('^\/') ? 'hidden' : '';
    attr['id'] = window.guid();
    $.each(['network', 'state', 'target'], function(i) { attr["data-" + this] = attr["data-" + this] || convos.current[this]; });

    socket.send($('<div/>').attr(attr).text(message).prop('outerHTML'));
    if (!message.match(/^\//)) addPendingMessage(message, attr);
    if (attr['data-history']) convos.addInputHistory(message);
    if (convos.at_bottom) $(window).scrollTo('bottom');
  };
})(jQuery);
