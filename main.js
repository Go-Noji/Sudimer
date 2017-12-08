/**
 * Created by go on 2017/11/16.
 */

define(function (require, exports, module) {
  "use strict";

  //色々インポートする
  var CommandManager = brackets.getModule("command/CommandManager"),
    KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
    AppInit = brackets.getModule("utils/AppInit"),
    Menus = brackets.getModule("command/Menus"),
    ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
    FileSystem = brackets.getModule("filesystem/FileSystem"),
    FileUtils = brackets.getModule("file/FileUtils"),
    Dialogs = brackets.getModule("widgets/Dialogs");

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

    Dialogs.showModalDialog('error', 'Your partner in Brackets: '+title, '<div class="partner-dialog-box"><figure class="partner-dialog-figure"><img src="'+partner.img+'" alt="'+partner.name+'" class="partner-dialog-img"></figure><div class="partner-dialog-message"><div class="partner-dialog-txt">'+error+'</div></div></div>', [{
      className: 'partners-partners-error',
      id: 'partners-partners-error',
      text: 'OK'
    }]);
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
      dateTime.year = dt.getYear();
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
        if(date){
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
   * @param target
   * @param type
   * @return {boolean}
   */
  var isTime = function (target) {
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

      //時が今より前
      if(hour < dateTime.hour && target.hour !== settings.default){
        return false;
      }
      //時が今より後
      else if(hour > dateTime.hour && target.hour !== settings.default){
        return true;
      }

      //時が今と同じor毎時設定の場合は分の判定へ
      //分が今より前
      if(minute < dateTime.minute && target.minute !== settings.default){
        return false;
      }
      //分が今より後
      else if(minute > dateTime.minute && target.minute !== settings.default){
        return true;
      }

      //分が今と同じor毎時設定の場合は秒の判定へ
      //秒が今より後
      if(seconds > dateTime.seconds && target.seconds !== settings.default){
        return true;
      }

      //時分秒全てが一緒だったら切り捨てる
      return false;
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
   * jsonをパースし、モデルへ仕込む
   * スケジュールが存在しない場合はfalseを返す
   * @param string json
   * @return bool
   */
  var scheduleRegister = function (json) {
    try{
      //生jsonをパース
      var data = JSON.parse(json);

      //スケジュールが登録されているか確認
      if(data.schedules[0] === undefined){
        //スケジュールが一つも登録されていなかった場合はfalseを返す
        return false;
      }

      //デフォルトを表す文字列の設定をオーバーライド
      if(data.default !== undefined && data.default !== null){
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
        var xhr = new XMLHttpRequest();
        xhr.open('HEAD', data.partner.image);
        xhr.send(null);
        if(xhr.status >= 400){
          throw 'imgUndefined';
        }
      }

      //スケジュールが最低一個登録されたかどうかのフラグ
      var scheduleFlg = false;

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
        if(!isTime(data.schedules[i])){
          continue;
        }

        //年月日時分秒全ての条件を満たしたらデータモデルに追加
        scheduleData.push(data.schedules[i]);

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
      }
      return false;
    }
  }

  /**
   * 現在時刻を監視し、定められた時刻を過ぎたスケジュールを実行する
   */
  var watchTimer = function () {
    console.log('pow');
    if(scheduleData.length){
    }

    //時刻のアップデート
    if(updateDateTime(false)){
      //日付をまたいだら初期化処理
      init();
    }
    else{
      mainTimer = setTimeout(watchTimer, settings.frequency * 1000);
    }
  }

  /**
   * 初期化処理
   * Bracketsを起動、もしくは日付をまたいだ際に呼ぶ
   */
  var init = function () {
    //日時情報を初期化
    updateDateTime(true);

    //パートナーのデフォルト画像を設定
    partner.img = getLocalFile('images/default.png');

    //スタイルの読み込み
    var link = document.createElement('link');
    link.setAttribute('href', getLocalFile('css/style.css'));
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(link);

    //jsonからデータを読む
    var jsonFile = FileSystem.getFileForPath(getLocalFile('schedule.json'));
    FileUtils.readAsText(jsonFile).then(function (data) {
      if(scheduleRegister(data)){
        //スケジュール登録が成功したら時間をウォッチするメインタイマー作動
        mainTimer = setTimeout(watchTimer, settings.frequency * 1000);
      }
    });
  }

  //初期化処理
  AppInit.appReady(function(){
    init();
  });
});