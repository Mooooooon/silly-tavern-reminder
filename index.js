// 扩展的主脚本
// 以下是一些基本扩展功能的示例

// 你可能需要从 extensions.js 导入 extension_settings, getContext 和 loadExtensionSettings
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

// 你可能需要从主脚本导入一些其他函数
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

// 跟踪扩展的位置，名称应与仓库名称匹配
const extensionName = "silly-tavern-reminder";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
    enableReminder: true, // 添加提醒功能的默认值
};

// 添加闪烁相关变量
let titleFlashTimer = null;
let originalTitle = document.title;
let isFlashing = false;

// 开始闪烁标题
function startTitleFlash() {
    if (isFlashing) return;
    isFlashing = true;
    originalTitle = document.title;
    titleFlashTimer = setInterval(() => {
        document.title = document.title === "【收到新消息了】" ? originalTitle : "【收到新消息了】";
    }, 1000);
}

// 停止闪烁标题
function stopTitleFlash() {
    if (titleFlashTimer) {
        clearInterval(titleFlashTimer);
        titleFlashTimer = null;
    }
    isFlashing = false;
    document.title = originalTitle;
}

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isFlashing) {
        stopTitleFlash();
    }
});

// 如果存在扩展设置，则加载它们，否则将其初始化为默认值
async function loadSettings() {
  // 如果设置不存在则创建它们
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // 在 UI 中更新设置
  $("#example_setting").prop("checked", extension_settings[extensionName].example_setting).trigger("input");
}

// 当扩展设置在 UI 中更改时调用此函数
function onReminderToggle(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].enableReminder = value;
  saveSettingsDebounced();
}

//监听消息生成完毕事件
eventSource.on(event_types.MESSAGE_RECEIVED, handleIncomingMessage);

function handleIncomingMessage(data) {
    // 只在提醒功能开启且页面隐藏时才修改标题和开始闪烁
    if (document.hidden && extension_settings[extensionName].enableReminder) {
        startTitleFlash();
    }
    // 如果页面可见，不做任何处理
}

// 当扩展加载时调用此函数
jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
    $("#extensions_settings2").append(settingsHtml);

    // 只保留复选框事件监听
    $("#example_setting").on("input", onReminderToggle);

    loadSettings();
});