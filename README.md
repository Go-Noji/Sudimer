# Sudimer

Sudimer is an extension of Brackets which makes dialogs appear, changes the background, and plays Youtube according to a schedule that can be freely set.

Sudimerは自由に設定できるスケジュールに沿ってダイアログを出したり、背景を変更したり、Youtubeを再生したりできるBracketsの拡張機能です。

## Description

Do you have a partner?

Yes, By using this extension you can let your partner stay in your Brackets.

## DEMO

![Sudimer DEMO.](http://noji.wpblog.jp/wp-content/uploads/2017/12/sudimer_000.gif)

## Install

1. Open the Brackets Extension Manager and search for "Sudimer".

2. Please push install button.

## Usage

### Open schedule.json and schedule-sample.json

First of all, select "Open schedule.json" and "Open schedule-sample.json" from the file menu.

Then JSON file for schedule setting and sample file of it will be opened.

schedule.json is a file for setting the schedule, Sudimer parses this file and works.
On the other hand, schedule-sample.json is a sample file for writing schedule.json, and editing does not affect Sdimer.

### schedule.json's parameter

+ __enable__: false does not work.
+ __default__: This is the default string. Use the character set here when using hourly or default settings.
+ __frequency__: This is a setting on how many seconds the schedule is monitored. Even less than 0.1 seconds will work, but it may burdening the Brackets.

********

+ __partner__: The setting of the person appearing in the dialog.
   + __image__: This is the string for image to set in the dialog. Strings starting with "http: //" or "https: //" refer to online. otherwise refer to images folder at the same level as this json file.
   + __name__: The name displayed in the dialog

********

+ __schedules__: Data of the action to be executed.
   + __year__, __month__, __date__, __hour__, __minute__, __seconds__: These are the year, month, day, hour, minute and second settings. When you enter the character set with default, it means "every ○". Note that the 0 to 23 for hours, 0 to 59 for minutes and seconds.
   + __message__: This is the sentence displayed in the dialog. If it is set to empty ("") or default character, dialog will not appear.
   + __background__: A setting to insert an image in the background of Brackets.
      + __url__: The URL of the image to be inserted. Just like partner's image, distinguish between online and local (images directory). When set to the empty ("") or default character, background action is ignored.
      + __size__: Sets the image size. It is the so-called background-size value of css. When setting other than "cover" ("contain" or 100px, etc.), images are displayed repeatedly. When set to empty ("") or default character, "cover" is applied.
      + __opacity__: Set transparency. It is the so-called opacity value of css. Please set it between 0 and 1. When set to the empty ("") or default character, 0.7 will be applied.
   + __youtube__: Play youtube on the background of Brackets. Please enter "https://www.youtube.com/watch?v=" This part "which is displayed in the address bar when you watch youtube. When set to the empty ("") or default character, Ignore this setting.
   
### Scan schedule.json

Normally, Sudimer analyzes schedule.json when Brackets is launched (also when updating), but it will also be analyzed when you select "Re-scan schedule" in the "File" menu.

Did the partner speak to you at the designated time?

Congrats!

## Licence

[MIT](https://github.com/Go-Noji/Sudimer/blob/master/LICENSE)

