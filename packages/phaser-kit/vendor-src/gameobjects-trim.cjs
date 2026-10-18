/**
 * Phaser.GameObjects 的收窄聚合（B 档）——只保留 CHAGS 实际用到的对象类型。
 *
 * 聚合 + 注册是副作用式的：每个 Factories/Creators 模块被 require 时就完成
 * scene.add.* / scene.make.* 的注册，所以这里列什么，运行时就有什么。
 * ⚠️ 与 entry.cjs 一样：这是 Phaser 内部路径，不是公开 API，升级 phaser 需复核 + 重跑 `pnpm phaser:trim`。
 *
 * 用法证据（2026-10 全量 grep packages/ + games/）：
 *   this.add.{graphics, container, text, zone}，另有 1 处 scene.add.rectangle；
 *   Phaser.GameObjects.{Container, Text, Graphics, GameObject, Zone}（多为类型引用）。
 *   没有 image / sprite / particles / bitmapText / tileSprite / renderTexture / shader / mesh 等调用。
 */
/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports -- CJS 聚合入口：require() 正是要交给 webpack 解析的静态依赖 */
var GameObjects = {
  Events: require('phaser-src/gameobjects/events'),

  DisplayList: require('phaser-src/gameobjects/DisplayList'),
  GameObjectCreator: require('phaser-src/gameobjects/GameObjectCreator'),
  GameObjectFactory: require('phaser-src/gameobjects/GameObjectFactory'),
  UpdateList: require('phaser-src/gameobjects/UpdateList'),

  Components: require('phaser-src/gameobjects/components'),
  GetCalcMatrix: require('phaser-src/gameobjects/GetCalcMatrix'),

  BuildGameObject: require('phaser-src/gameobjects/BuildGameObject'),
  BuildGameObjectAnimation: require('phaser-src/gameobjects/BuildGameObjectAnimation'),
  GameObject: require('phaser-src/gameobjects/GameObject'),

  Container: require('phaser-src/gameobjects/container/Container'),
  Graphics: require('phaser-src/gameobjects/graphics/Graphics'),
  Text: require('phaser-src/gameobjects/text/Text'),
  GetTextSize: require('phaser-src/gameobjects/text/GetTextSize'),
  MeasureText: require('phaser-src/gameobjects/text/MeasureText'),
  TextStyle: require('phaser-src/gameobjects/text/TextStyle'),
  Zone: require('phaser-src/gameobjects/zone/Zone'),

  // 形状：目前只有 1 个游戏用到 rectangle
  Shape: require('phaser-src/gameobjects/shape/Shape'),
  Rectangle: require('phaser-src/gameobjects/shape/rectangle/Rectangle'),

  Factories: {
    Container: require('phaser-src/gameobjects/container/ContainerFactory'),
    Graphics: require('phaser-src/gameobjects/graphics/GraphicsFactory'),
    Text: require('phaser-src/gameobjects/text/TextFactory'),
    Zone: require('phaser-src/gameobjects/zone/ZoneFactory'),
    Rectangle: require('phaser-src/gameobjects/shape/rectangle/RectangleFactory'),
  },

  Creators: {
    Container: require('phaser-src/gameobjects/container/ContainerCreator'),
    Graphics: require('phaser-src/gameobjects/graphics/GraphicsCreator'),
    Text: require('phaser-src/gameobjects/text/TextCreator'),
    Zone: require('phaser-src/gameobjects/zone/ZoneCreator'),
  },
};

module.exports = GameObjects;
