const WEB_WORKER_URL = 'js/align-4-worker.js';
const BLURBS = {
  'start': {
    header: '做好準備',
    blurb: '選擇你的難度並開始遊戲。'
  },
  'p1-turn': {
    header: '輪到你了',
    blurb: '點擊圖板放下你的籌碼。'
  },
  'p2-turn': {
    header: '輪到電腦了',
    blurb: '電腦正在嘗試尋找讓你輸的最佳方法。'
  },
  'p1-win': {
    header: '你贏了',
    blurb: '你是贏家。記住這一刻，並永遠隨身攜帶。'
  },
  'p2-win': {
    header: '電腦贏了',
    blurb: '擦乾羞愧眼淚後，請再試一次。'
  },
  'tie': {
    header: '平手',
    blurb: '每個人都是贏家！或是失敗者！取決於你如何看待它。'
  }
};
const OUTLOOKS = {
  'win-imminent': '哦，電腦感覺很安全！',
  'loss-imminent': '電腦不是很確定。現在是你的機會！'
};

var worker;
var currentGameState;

$(function() {
  $('.start button').on('click', startGame);
  setBlurb('start');
  setOutlook();

  worker = new Worker(WEB_WORKER_URL);
  worker.addEventListener('message', function(e) {
    switch(e.data.messageType) {
      case 'reset-done':
        startHumanTurn();
        break;
      case 'human-move-done':
        endHumanTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull);
        break;
      case 'progress':
        updateComputerTurn(e.data.col);
        break;
      case 'computer-move-done':
        endComputerTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull,
          e.data.isWinImminent, e.data.isLossImminent);
        break;
    }
  }, false);
});

function setBlurb(key) {
  $('.info h2').text(BLURBS[key].header);
  $('.info .blurb').text(BLURBS[key].blurb);
}

function setOutlook(key) {
  var $outlook = $('.info .outlook');
  if(key) {
    $outlook
      .text(OUTLOOKS[key])
      .show();
  } else {
    $outlook.hide();
  }
}

function startGame() {
  $('.dif').addClass('freeze');
  $('.dif input').prop('disabled', true);
  $('.lit-cells, .chips').empty();

  worker.postMessage({
    messageType: 'reset',
  });
}

function startHumanTurn() {
  setBlurb('p1-turn');
  $('.click-columns div').addClass('hover');

  var col = $('.click-columns div:hover').index();
  if(col !== -1) {
    createCursorChip(1, col);
  }
  
  $('.click-columns')
    .on('mouseenter', function() {
      var col = $('.click-columns div:hover').index();
      createCursorChip(1, col);
    })
    .on('mouseleave', function() {
      destroyCursorChip();
    });
  
  $('.click-columns div')
    .on('mouseenter', function() {
      var col = $(this).index();
      moveCursorChip(col);
    })
    .on('click', function() {
      $('.click-columns, .click-columns div').off();
      
      var col = $(this).index();
      worker.postMessage({
        messageType: 'human-move',
        col: col
      });
    });  
}

function endHumanTurn(coords, isWin, winningChips, isBoardFull) {
  $('.click-columns div').removeClass('hover');
  if(!coords) {
    startHumanTurn();    
  } else {
    dropCursorChip(coords.row, function() {
      if(isWin) {
        endGame('p1-win', winningChips);
      } else if(isBoardFull) {
        endGame('tie');
      } else {
        startComputerTurn();
      }
    });
  }
}

function startComputerTurn() {
  setBlurb('p2-turn');

  createCursorChip(2, 0);
  
  var maxDepth = parseInt($('input[name=dif-options]:checked').val(), 10) + 1;
  worker.postMessage({
    messageType: 'computer-move',
    maxDepth: maxDepth
  });
}

function updateComputerTurn(col) {
  moveCursorChip(col);
}

function endComputerTurn(coords, isWin, winningChips, isBoardFull, isWinImminent, isLossImminent) {
  moveCursorChip(coords.col, function() {
    dropCursorChip(coords.row, function() {
      if (isWin) {
        endGame('p2-win', winningChips);
      } else if (isBoardFull) {
        endGame('tie');
      } else {
        if(isWinImminent) {
          setOutlook('win-imminent');
        } else if (isLossImminent) {
          setOutlook('loss-imminent');
        } else {
          setOutlook();
        }

        startHumanTurn();
      }
    });
  });
}

function endGame(blurbKey, winningChips) {
  $('.dif').removeClass('freeze');
  $('.dif input').prop('disabled', false);
  setBlurb(blurbKey);
  setOutlook();
  
  if(winningChips) {
    for(var i = 0; i < winningChips.length; i++) {
      createLitCell(winningChips[i].col, winningChips[i].row);
    }
  }
}

function createLitCell(col, row) {
  $('<div>')
  .css({
    'left': indexToPixels(col),
    'bottom': indexToPixels(row)
  })
  .appendTo('.lit-cells');
}

function createCursorChip(player, col) {
  var playerClass = 'p' + player;
  $('<div>', { 'class': 'cursor ' + playerClass })
    .css('left', indexToPixels(col))
    .appendTo('.chips');

  $('.lit-columns div').eq(col).addClass('lit');
}

function destroyCursorChip() {
  $('.chips .cursor').remove();
  $('.lit-columns .lit').removeClass('lit');
}

function moveCursorChip(col, callback) {
  $('.chips .cursor').css('left', indexToPixels(col));
  $('.lit-columns .lit').removeClass('lit');
  $('.lit-columns div').eq(col).addClass('lit');
  setTimeout(callback, 300);
}

function dropCursorChip(row, callback) {
  var ms = (7 - row) * 40;
  var duration = (ms / 1000) + 's';
  
  $('.chips .cursor')
    .removeClass('cursor')
    .css({
      'bottom': indexToPixels(row),
      'transition-duration': duration,
      'animation-delay': duration
    })
    .addClass('dropped');
  
  $('.lit-columns .lit').removeClass('lit');
  setTimeout(callback, ms);
}

function indexToPixels(index) {
  return (index * 61 + 1) + 'px';
}