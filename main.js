define(function (require, exports, module) {
  "use strict";

  //色々インポートする
  var CommandManager = brackets.getModule("command/CommandManager"),
    DocumentManager = brackets.getModule("document/DocumentManager"),
    AppInit = brackets.getModule("utils/AppInit"),
    Menus = brackets.getModule("command/Menus"),
    ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
    FileSystem = brackets.getModule("filesystem/FileSystem"),
    FileUtils = brackets.getModule("file/FileUtils"),
    Dialogs = brackets.getModule("widgets/Dialogs");

  //schedule.jsonの原文ママが入る
  var json = '{}';

  //設定
  var settings = {
    'frequency': 60,
    'default': '*'
  };

  //パートナーデータ
  var partner = {
    'name': 'Your partner in Brackets',
    'img': ''
  }

  //いつ、何をするかのスケジュールデータ
  var scheduleData = [];

  //現在時間データ
  var dateTime = {
    'year': 0,
    'month': 0,
    'date': 0,
    'hour': 0,
    'minute': 0,
    'seconds': 0
  }

  //時間ごとにメインの処理を行うタイマー変数
  var mainTimer = false;

  //前回アクションを行った時の秒
  var beforeActionSeconds = 60;

  //初期化コマンドID
  var INIT_ID = "init.run";

  //schedule.jsonを開くコマンドID
  var OPEN_JSON_ID = "openScheduleFile.run";

  //schedule.jsonを開くコマンドID
  var OPEN_SAMPLE_JSON_ID = "openScheduleSampleFile.run";

  //コンソールを表示するかどうか
  var enableConsole = false;

  /**
   * 正の整数を返す
   * 変な値だったらNaNを返す
   * @param num
   * @return {number}
   */
  var getInteger = function (num) {
    return Math.abs(Number(num));
  }

  /**
   * このmain.jsがある階層からの相対パスをpathに仕込む
   * そのpathが示すファイルを返す
   * @param path
   * @return {string}
   */
  var getLocalFile = function (path) {
    return ExtensionUtils.getModulePath(module, path);
  }

  /**
   * エラーダイアログを出現させる
   * その前にこの拡張機能の動作もストップさせる
   * @param title
   * @param error
   */
  var showError = function(title, error){
    clearTimeout(mainTimer);

    Dialogs.showModalDialog('error', 'Sudimer: '+title, '<div class="partner-dialog-box"><figure class="partner-dialog-figure"><img src="'+partner.img+'" alt="'+partner.name+'" class="partner-dialog-img"></figure><div class="partner-dialog-message"><div class="partner-dialog-txt">'+error+'</div></div></div>', [{
      className: 'partners-partners-error',
      id: 'partners-partners-error',
      text: 'OK'
    }]);
  }

  /**
   * パスを正しく認識できる文字列にして返す
   * httpから始まる文字列だったら存在確認をする
   * それ以外だったらローカルに存在する画像だと判断し、
   * 画像の存在確認をする
   * @param {string} path
   * @return {promise}
   */
  var convertImagePath = function (path){
    return new Promise (function(resolve, reject){
      //文字列かどうか確認
      if(typeof (path) !== 'string')
      {
        reject({type: 'imgPathTypeError', path: path});
      }

      //http, もしくはhttpsから始まる文字列だった場合
      else if(path.match(/^https?:\/\/.*$/)){
        //画像の存在確認
        var xhr = new XMLHttpRequest();
        xhr.path = path;
        xhr.onreadystatechange = function () {
          if ((xhr.readyState === 4)){
            if(xhr.status >= 400 || xhr.status === 0){
              reject({type: 'imgUndefined', path: this.path});
            }
            else{
              resolve(this.path);
            }
          }
        }
        xhr.open('HEAD', path);
        xhr.send(null);
      }

      //このmain.jsと同階層のimagesにあると判断
      else{
        var image = new Image();
        image.src = getLocalFile('images/'+path);
        image.onerror = function() {
          reject({type: 'imgUndefined', path: this.src});
        }
        image.onload = function() {
          resolve(this.src);
        }
      }
    });
  }

  /**
   * 日付データをアップデートする
   * 初期化処理の際にのみfirstをtrueにする
   * 前回のアップデートから日付をまたいだ際にtrueを返す
   * @param bool first
   * @return bool
   */
  var updateDateTime = function (first) {
    //Dateオブジェクト生成
    var dt = new Date();

    //時分秒処理
    dateTime.hour = dt.getHours();
    dateTime.minute = dt.getMinutes();
    dateTime.seconds = dt.getSeconds();

    //年月日処理
    var day = dt.getDate();
    if(first){
      //もし初期化処理だったら年月日もアップデート
      dateTime.year = dt.getFullYear();
      dateTime.month = dt.getMonth()+1;
      dateTime.date = day;
    }
    else if(dateTime.date !== day){
      //日をまたいだらtrueを返す
      return true;
    }

    //日付をまたいでいない場合はfalseを返す
    return false;
  };

  /**
   * 年月日が本日にあたるかどうかを判断する
   * 異常な値が設定されていたら例外を投げる
   * @param target
   * @param type
   * @return {boolean}
   */
  var isToday = function (target, type) {
    try{
      if(target[type] !== settings.default){
        var date = getInteger(target[type]);
        if(!date){
          switch (type){
            case 'year':
              throw 'scheduleYearError';
            case 'month':
              throw 'scheduleMonthError';
            case 'date':
              throw 'scheduleDateError';
          }
        }
        else if(date !== dateTime[type]){
          return false;
        }
      }

      return true;
    }
    catch (e){
      switch (e){
        case 'scheduleYearError':
          showError('スケジュールの年設定が正しくありません', '<p>schedules.jsonのschedulesに設定されたyearが1以上の整数ではありません。。</p>');
          break;
        case 'scheduleMonthError':
          showError('スケジュールの月設定が正しくありません', '<p>schedules.jsonのschedulesに設定されたmonthが1以上の整数ではありません。。</p>');
          break;
        case 'scheduleDateError':
          showError('スケジュールの日設定が正しくありません', '<p>schedules.jsonのschedulesに設定されたdateが1以上の整数ではありません。。</p>');
          break;
      }
      return false;
    }
  }

  /**
   * 時分秒が今以降にあたるかどうかを判断する
   * ただし年月日を考慮しないので注意
   * 異常な値が設定されていたら例外を投げる
   * everyがtrueの場合は毎○をfalseとして返す
   * @param target
   * @param every
   * @return {boolean}
   */
  var isTime = function (target, every) {
    try{
      var hour = getInteger(target.hour);
      if(hour > 24 && target.hour !== settings.default){
        //24以上の数字は存在しないのでエラー
        throw 'scheduleHourError';
      }

      var minute = getInteger(target.minute);
      if(minute > 59 && target.minute !== settings.default){
        //59以上の数字は存在しないのでエラー
        throw 'scheduleMinuteError';
      }

      var seconds = getInteger(target.seconds);
      if(seconds > 59 && target.seconds !== settings.default){
        //59以上の数字は存在しないのでエラー
        throw 'scheduleSecondsError';
      }

      //毎時に相当する
      if(every && target.hour === settings.default){
        return true;
      }

      //時が今より前
      if(hour < dateTime.hour && target.hour !== settings.default){
        return false;
      }

      //時が今より後
      else if(hour > dateTime.hour && target.hour !== settings.default){
        return true;
      }



      //時が今と同じor毎時設定の場合は分の判定へ
      // 毎分に相当する
      if(every && target.minute === settings.default){
        return true;
      }

      //分が今より前
      if(minute < dateTime.minute && target.minute !== settings.default){
        return false;
      }

      //分が今より後
      else if(minute > dateTime.minute && target.minute !== settings.default){
        return true;
      }



      //分が今と同じor毎時設定の場合は秒の判定へ
      // 毎秒に相当する
      if(every && target.seconds === settings.default){
        return true;
      }

      //秒が今より前
      if(seconds < dateTime.seconds && target.seconds !== settings.default){
        return false;
      }

      //秒が今より後
      else if(seconds > dateTime.seconds && target.seconds !== settings.default){
        return true;
      }

      //時分秒全てが一緒だったらtrue
      return true;
    }
    catch (e){
      switch (e) {
        case 'scheduleHourError':
          showError('スケジュールの時設定が正しくありません', '<p>schedules.jsonのschedulesに設定されたhourが0以上24以下の整数ではありません。。</p>');
          break;
        case 'scheduleMinuteError':
          showError('スケジュールの分設定が正しくありません', '<p>schedules.jsonのschedulesに設定されたminuteが0以上59以下の整数ではありません。。</p>');
          break;
        case 'scheduleSecondsError':
          showError('スケジュールの秒設定が正しくありません', '<p>schedules.jsonのschedulesに設定されたsecondsが0以上59以下の整数ではありません。。</p>');
          break;
      }
      return false;
    }
  }

  /**
   * targetで渡されたアクションが今実行されるべきかを判断する
   * @param target
   * @return {boolean}
   */
  var isNow = function (target) {
    //ロックされているアクションは即falseを返す
    if(target.lock){
      if(enableConsole){
        console.log('[Sudimer] isNow return false reason: action was locked.');
      }
      return false;
    }

    //時が今にあたらなければfalseを返す
    if(target.hour !== settings.default && Number(target.hour) !== dateTime.hour){
      if(enableConsole){
        console.log('[Sudimer] isNow return false reason: action hour is "'+target.hour+'", Now hour is "'+dateTime.hour+'".');
      }
      return false;
    }

    //分が今にあたらなければfalseを返す
    if(target.minute !== settings.default && Number(target.minute) !== dateTime.minute){
      if(enableConsole){
        console.log('[Sudimer] isNow return false reason: action minute is "'+target.minute+'", Now minute is "'+dateTime.minute+'".');
      }
      return false;
    }

    //秒が未来にあたればfalseを返す
    if(target.seconds !== settings.default && Number(target.seconds) > dateTime.seconds){
      if(enableConsole){
        console.log('[Sudimer] isNow return false reason: action seconds is "'+target.seconds+'", Now seconds is "'+dateTime.seconds+'".');
      }
      return false;
    }

    //時が現時刻と同値 or 毎時
    //&&分が現時刻と同値 or 毎分
    //&&秒が現時刻と同値 or 既に過去 or 毎分
    if(enableConsole){
      console.log('isNow return true.');
    }
    return true;
  }

  /**
   * jsonをパースし、モデルへ仕込む
   * スケジュールが存在しない or 無効設定されている場合はfalseを返す
   * initをtrueにするとデフォルト値も検証・上書きする
   * @param string json
   * @param bool init
   * @return bool
   */
  var scheduleRegister = function (json, init) {
    try{
      //生jsonをパース
      var data = JSON.parse(json);

      //もしenableがfalseだったら何もしない
      if(!data.enable){
        return false;
      }

      //initがtrueだったら各種設定
      if(init){
        //スケジュールが登録されているか確認
        if(data.schedules[0] === undefined){
          //スケジュールが一つも登録されていなかった場合はfalseを返す
          return false;
        }

        //デフォルトを表す文字列の設定をオーバーライド
        if(!isNaN(getInteger(data.default))){
          throw 'defaultIntegerError';
        }
        else if(data.default !== '' && data.default !== undefined && data.default !== null){
          settings.default = data.default;
        }

        //何秒ごとに処理するかの設定をオーバーライド
        if(data.frequency !== undefined && data.frequency !== settings.default){
          var frequency = getInteger(data.frequency);
          if(Math.round(frequency) !== frequency){
            throw 'frequencyError';
          }
          settings.frequency = frequency;
        }

        //パートナー名をオーバーライド
        if(data.partner.name === undefined){
          throw 'nameError';
        }
        else if(data.partner.name !== settings.default){
          partner.name = data.partner.name;
        }

        //パートナー画像をオーバーライド
        if(data.partner.image === undefined){
          throw 'imgError';
        }
        else if(data.partner.image !== settings.default){
          //画像の存在確認
          convertImagePath(data.partner.image)
            .then(function (path) {
              partner.img = path;
            },
            function (error) {
              //例外処理
              switch (error.type){
                case 'imgUndefined':
                  showError('画像を読み込めませんでした', '<p>指定された画像が存在しません('+error.path+')</p>');
                  break;
              }
            });
        }
      }

      //スケジュールが最低一個登録されたかどうかのフラグ
      var scheduleFlg = false;

      //スケジュール初期化
      scheduleData = [];

      //スケジュールごとに登録処理を開始
      for(var i = 0; i < data.schedules.length; i++){
        //年の検証
        if(!isToday(data.schedules[i], 'year')){
          continue;
        }

        //月の検証
        if(!isToday(data.schedules[i], 'month')){
          continue;
        }

        //日の検証
        if(!isToday(data.schedules[i], 'date')){
          continue;
        }

        //時分秒の検証
        if(!isTime(data.schedules[i], true)){
          continue;
        }

        //年月日時分秒全ての条件を満たしたらlockプロパティを
        // 追加してデータモデルに追加
        var pushData = data.schedules[i];
        pushData.lock = false;
        scheduleData.push(pushData);

        //スケジュールフラグをtrueにする
        scheduleFlg = true;
      }

      //スケジュールが最低一個は存在したのでtrueを返す
      if(scheduleFlg){
        return true;
      }

      //スケジュールがなかったのでfalseを返す
      return false;
    }
    catch (e){
      //例外処理
      switch (e){
        case 'frequencyError':
          showError('更新頻度の設定が不正です', '<p>schedules.jsonのfrequencyが1以上の整数ではありません。</p>');
          break;
        case 'nameError':
          showError('パートナーの名前設定が見つかりません', '<p>schedules.jsonのpartner.nameが見つかりません。</p>');
          break;
        case 'imgError':
          showError('パートナーの画像設定が見つかりません', '<p>schedules.jsonのpartner.imageが見つかりません。</p>');
          break;
        case 'imgUndefined':
          showError('パートナーの画像に設定されたファイルが見つかりません', '<p>schedules.jsonのpartner.imageで設定されたファイルが存在しないようです。</p>');
          break;
        case 'defaultIntegerError':
          showError('デフォルト文字に数値は使えません', '<p>schedules.jsonのdefaultに数値、または数値に変換可能な文字列は使えません。</p>');
          break;
        default:
          showError('JSONが読み取れません', '<p>schedules.jsonのどこかにエラーがある可能性があります。</p>');
          break;
      }
      return false;
    }
  }

  /**
   * 渡されたアクションを実行する
   * @param target
   */
  var doAction = function (target) {
    //messageが入力されていたらダイアログを出す
    if(target.message && target.message !== '' && target.message !== settings.default){
      Dialogs.showModalDialog('message', partner.name, '<div class="partner-dialog-box"><figure class="partner-dialog-figure"><img src="'+partner.img+'" alt="'+partner.name+'" class="partner-dialog-img"></figure><div class="partner-dialog-message"><div class="partner-dialog-txt">'+target.message+'</div></div></div>', [{
        className: 'partners-partners-message',
        id: 'partners-partners-message',
        text: 'OK'
      }]);
    }

    //Youtube挿入&バックグラウンド操作対象のdiv
    var backgroundElement = document.getElementById('partner-background');

    //Youtubeの動画URLが設定されていたらそれを挿入する
    if(target.youtube && target.youtube !== '' && target.youtube !== settings.default){
      var youtube = document.createElement('iframe');
      youtube.setAttribute('id', 'partner-youtube');
      youtube.setAttribute('class', 'partner-youtube');
      youtube.setAttribute('width', backgroundElement.clientWidth);
      youtube.setAttribute('height', backgroundElement.clientWidth);
      youtube.setAttribute('src', 'https://www.youtube.com/embed/'+target.youtube+'?autoplay=1');
      youtube.setAttribute('frameborder', '0');
      youtube.setAttribute('gesture', 'media');
      youtube.setAttribute('allow', 'encrypted-media');
      backgroundElement.innerHTML = '';
      backgroundElement.appendChild(youtube);
    }

    //imageのurlが設定されていたらバックグラウンドを変更する
    if(target.background && target.background.url !== '' && target.background.url !== settings.default){
      convertImagePath(target.background.url)
        .then(function (path) {
          //background-image
          backgroundElement.style.backgroundImage = 'url("'+path+'")';

          //background-size
          if(target.background.size !== '' && target.background.size !== settings.default){
            backgroundElement.style.backgroundSize = target.background.size;
          }

          //opacity
          if(target.background.opacity !== '' && target.background.opacity !== settings.default){
            backgroundElement.style.opacity = target.background.opacity;
          }

        }, function (error) {
          //例外処理
          switch (error.type){
            case 'imgUndefined':
              showError('画像を読み込めませんでした', '<p>backgroundのurl指定された画像が存在しません('+error.path+')</p>');
              break;
          }
        });
    }
  }

  /**
   * 現在時刻を監視し、定められた時刻を過ぎたスケジュールを実行する
   * @return bool
   */
  var watchTimer = function () {

    //この関数で実行されたアクション集
    var doActions = [];

    //今日処理するべきスケジュールをループ解析
    if(scheduleData.length){
      for(var i = 0; i < scheduleData.length; i++){
        if(isNow(scheduleData[i])){
          doAction(scheduleData[i]);
          doActions.push(i);
        }
      }
    }

    //時刻のアップデート
    //trueなら中日付更新処理をしてreturn
    if(updateDateTime(false)){
      //日付をまたいだら初期化処理
      init();

      //ここで終了
      return actionFlg;
    }

    //もし一回でもアクションを起こしていたら
    // 実行済みアクションをロックする
    //ただし、毎秒設定がonだったらロックしない
    var actionFlg = false;
    if(doActions.length > 0){
      actionFlg = true;
      for (var i = 0; i < doActions.length; i++){
        if(scheduleData[doActions[i]].seconds === settings.default){
          continue;
        }

        //該当アクションのロック
        scheduleData[doActions[i]].lock = true;
      }
    }

    //前回アクション実行時の秒が今回の秒より大きい
    //例えば前回実行時は45分だったのが46分になったとき
    //すべてのスケジュールロックを外す
    var nowSeconds = new Date().getSeconds();
    if(beforeActionSeconds > nowSeconds){
      for (var i = 0; i < scheduleData.length; i++){
        scheduleData[i].lock = false;
      }
    }

    //前回アクション実行時の秒を更新
    beforeActionSeconds = nowSeconds;

    //updateDateTime関数がfalseを返した
    //よって日付をまたいでいないので次のループを回す
    mainTimer = setTimeout(watchTimer, settings.frequency * 1000);

    return actionFlg;
  }

  /**
   * 初期化処理
   * Bracketsを起動、もしくは日付をまたいだ際に呼ぶ
   * スケジュールを読みこむ
   */
  var init = function () {
    //タイマーを停止
    clearTimeout(mainTimer);

    //日時情報を初期化
    updateDateTime(true);

    //前回アクション時の秒を初期化
    beforeActionSeconds = 60;

    //jsonからデータを読む
    var jsonFile = FileSystem.getFileForPath(getLocalFile('schedule.json'));
    FileUtils.readAsText(jsonFile).then(function (data) {
      //後々使うのでjsonデータを保存
      json = data;

      //スケジュール登録
      if(scheduleRegister(data, true)){
        //スケジュール登録が成功したら時間をウォッチするメインタイマー作動
        mainTimer = setTimeout(watchTimer, settings.frequency * 1000);
      }
      else{
        if(enableConsole){
          console.log('[Sdimer] Schedule is none.');
        }
      }
    });
  }

  /**
   * Bracketsでファイルを開く
   * @param fileName
   */
  var openFile = function (fileName) {
    DocumentManager.getDocumentForPath(FileSystem.getFileForPath(getLocalFile(fileName))._path).done(
      function (doc) {
        DocumentManager.setCurrentDocument(doc);
      }
    );
  }

  /**
   * schedule.jsonを開く
   */
  var openScheduleFile = function () {
    openFile('schedule.json');
  }

  /**
   * schedule-sample.jsonを開く
   */
  var openScheduleSampleFile = function () {
    openFile('schedule-sample.json');
  }

  //初期化処理
  AppInit.appReady(function(){

    //コマンドの登録
    CommandManager.register('Sudimer: Re-scan schedule', INIT_ID, init);
    CommandManager.register('Sudimer: Open schedule.json', OPEN_JSON_ID, openScheduleFile);
    CommandManager.register('Sudimer: Open schedule-sample.json', OPEN_SAMPLE_JSON_ID, openScheduleSampleFile);

    //メニューの追加
    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    var divider = menu.addMenuDivider(null, 'sdimer');
    menu.addMenuItem(INIT_ID, [], divider.LAST_IN_SECTION);
    menu.addMenuItem(OPEN_JSON_ID, [], divider.LAST_IN_SECTION);
    menu.addMenuItem(OPEN_SAMPLE_JSON_ID, [], divider.LAST_IN_SECTION);

    //パートナーのデフォルト画像を設定
    partner.img = getLocalFile('images/default.png');

    //スタイルの読み込み
    var link = document.createElement('link');
    link.setAttribute('href', getLocalFile('css/style.css'));
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(link);

    //background読み込み用のdivを追加
    var content = document.getElementById('editor-holder');
    var backgroud = document.createElement('div');
    backgroud.setAttribute('id', 'partner-background');
    backgroud.setAttribute('class', 'partner-background');
    backgroud.setAttribute('style', 'height: '+content.clientHeight+'px;');
    content.appendChild(backgroud);

    //初期化メソッド作動
    init();
  });
});