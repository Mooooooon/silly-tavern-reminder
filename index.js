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
    enabled: true, // 总开关默认值
    enableReminder: true, // 添加提醒功能的默认值
    enableNotification: true, // 添加通知功能的默认值
    enableTickSound: false, // 添加滴答声提醒功能的默认值
};

// 添加闪烁相关变量
let titleFlashTimer = null;
let originalTitle = document.title;
let isFlashing = false;

// 添加滴答声音频元素
let tickSound = null;
let tickSoundLoaded = false;
let tickSoundFailed = false;
let soundPath = `/scripts/extensions/third-party/${extensionName}/assets/tick.mp3`;

// 请求通知权限
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("此浏览器不支持通知功能");
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    } catch (error) {
        console.error("请求通知权限时出错:", error);
        return false;
    }
}

// 发送通知
function sendNotification() {
    if (!extension_settings[extensionName].enabled) {
        console.debug("扩展已禁用，不发送通知");
        return;
    }

    if (Notification.permission === "granted" && extension_settings[extensionName].enableNotification) {
        new Notification("SillyTavern 新消息", {
            body: "您有新的消息",
            icon: "/favicon.ico"
        });
    }
}

// 播放滴答声，增加更多错误检查和调试信息
function playTickSound() {
    if (!extension_settings[extensionName].enabled) {
        console.debug("扩展已禁用，不播放滴答声");
        return;
    }

    if (!extension_settings[extensionName].enableTickSound) {
        console.debug("滴答声已禁用");
        return;
    }

    if (!tickSound) {
        console.error("滴答声音频未加载");
        return;
    }

    if (tickSoundFailed) {
        console.error("滴答声音频加载失败，无法播放");
        return;
    }

    if (!tickSoundLoaded) {
        console.warn("滴答声音频尚未加载完成");
        return;
    }

    console.debug("尝试播放滴答声...");

    try {
        tickSound.currentTime = 0;
        const playPromise = tickSound.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.debug("滴答声播放成功");
            }).catch(error => {
                console.error("播放滴答声失败:", error);
                // 如果是因为用户交互限制，提示用户
                if (error.name === "NotAllowedError") {
                    console.error("浏览器限制了自动播放，请先与页面交互");
                    toastr.warning("浏览器限制了自动播放，请点击'测试滴答声'按钮解锁音频播放功能");
                }
            });
        }
    } catch (error) {
        console.error("播放滴答声时发生异常:", error);
    }
}

// 开始闪烁标题
function startTitleFlash() {
    if (!extension_settings[extensionName].enabled) {
        console.debug("扩展已禁用，不闪烁标题");
        return;
    }

    if (isFlashing) return;

    isFlashing = true;
    let flash = true;
    originalTitle = document.title;

    titleFlashTimer = setInterval(() => {
        if (flash) {
            document.title = "【新消息】 " + originalTitle;
        } else {
            document.title = originalTitle;
        }
        flash = !flash;
    }, 1000);
}

// 停止闪烁标题
function stopTitleFlash() {
    isFlashing = false;
    if (titleFlashTimer) {
        clearInterval(titleFlashTimer);
        titleFlashTimer = null;
    }
    document.title = originalTitle;
}

// 从extension_settings或本地存储中加载设置
function loadSettings() {
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // 修改更新UI的方式，避免触发input事件
  $("#extension_enabled").prop("checked", extension_settings[extensionName].enabled);
  $("#title_reminder_setting").prop("checked", extension_settings[extensionName].enableReminder);
  $("#notification_setting").prop("checked", extension_settings[extensionName].enableNotification);
  $("#tick_sound_setting").prop("checked", extension_settings[extensionName].enableTickSound);

  // 更新子开关的禁用状态
  updateSubswitchesState();

  // 如果音频加载失败，禁用滴答声选项并显示错误
  if (tickSoundFailed) {
      $("#tick_sound_setting").prop("disabled", true);
      $("#tick_sound_error").show();
  } else {
      $("#tick_sound_error").hide();
  }
}

// 更新子开关的禁用状态
function updateSubswitchesState() {
    const isEnabled = extension_settings[extensionName].enabled;
    $("#title_reminder_setting, #notification_setting, #tick_sound_setting").prop("disabled", !isEnabled);
    $("#test_tick_sound, #request_notification_permission").prop("disabled", !isEnabled);
}

// 添加总开关切换函数
function onExtensionEnabledToggle(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enabled = value;
    updateSubswitchesState();
    saveSettingsDebounced();

    // 如果禁用扩展，则停止所有正在进行的提醒
    if (!value) {
        stopTitleFlash();
    }
}

// 当扩展设置在 UI 中更改时调用此函数
function onReminderToggle(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].enableReminder = value;
  saveSettingsDebounced();
}

// 修改通知设置切换函数
async function onNotificationToggle(event) {
    const value = Boolean($(event.target).prop("checked"));

    // 只有当用户手动开启通知时才请求权限
    if (value && Notification.permission === "denied") {
        toastr.error('通知权限已被拒绝，请在浏览器设置中手动开启');
        $(event.target).prop("checked", false);
        return;
    }

    // 如果是程序设置的checked状态，不要请求权限
    if (value && Notification.permission !== "granted" && event.isTrigger === undefined) {
        const granted = await requestNotificationPermission();
        if (!granted) {
            $(event.target).prop("checked", false);
            return;
        }
    }

    extension_settings[extensionName].enableNotification = value;
    saveSettingsDebounced();
}

// 添加滴答声设置切换函数
function onTickSoundToggle(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enableTickSound = value;
    saveSettingsDebounced();
}

// 请求通知权限的点击处理函数
async function onRequestPermissionClick() {
    const granted = await requestNotificationPermission();
    if (granted) {
        toastr.success('已获得通知权限');
        // 自动勾选通知复选框
        $("#notification_setting").prop("checked", true);
        extension_settings[extensionName].enableNotification = true;
        saveSettingsDebounced();
    } else {
        toastr.error('未能获得通知权限');
    }
}

// 测试滴答声的点击处理函数
function onTestTickSoundClick() {
    if (tickSoundFailed) {
        toastr.error('滴答声音频加载失败，无法测试');
        return;
    }

    if (!tickSoundLoaded) {
        toastr.warning('滴答声音频正在加载中，请稍后再试');
        return;
    }

    console.debug("测试滴答声音频");
    playTickSound();
    toastr.success('测试滴答声已播放');
}

// 处理新消息提醒
function handleNewMessage() {
    if (!extension_settings[extensionName].enabled) {
        console.debug("扩展已禁用，不处理新消息提醒");
        return;
    }

    // 检查是否需要提醒（页面不可见）
    const needReminder = document.hidden;

    // 标题闪烁提醒
    if (needReminder && extension_settings[extensionName].enableReminder) {
        startTitleFlash();
    }
    // 系统通知提醒
    if (needReminder && extension_settings[extensionName].enableNotification) {
        sendNotification();
    }
    // 滴答声提醒 - 无论页面是否可见都播放
    if (extension_settings[extensionName].enableTickSound) {
        console.debug("尝试播放滴答声提醒...");
        playTickSound();
    }
}

// 加载音频文件，增加错误处理和状态检查
function loadAudio() {
    console.debug("开始加载滴答声音频...");

    try {
        tickSound = new Audio(soundPath);

        // 添加加载事件监听
        tickSound.addEventListener('canplaythrough', () => {
            console.debug("滴答声音频加载完成");
            tickSoundLoaded = true;
        });

        tickSound.addEventListener('error', (e) => {
            console.error("滴答声音频加载失败:", e);
            tickSoundFailed = true;
            toastr.error('滴答声音频加载失败，请检查音频文件是否存在');
            loadSettings(); // 更新UI状态
        });

        // 预加载
        tickSound.load();
    } catch (error) {
        console.error("创建音频对象时出错:", error);
        tickSoundFailed = true;
        toastr.error('创建音频对象失败: ' + error.message);
        loadSettings(); // 更新UI状态
    }
}

// 当扩展加载时调用此函数
jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/reminder.html`);
    $("#extensions_settings2").append(settingsHtml);

    // 加载CSS文件
    const styleSheet = document.createElement('link');
    styleSheet.rel = 'stylesheet';
    styleSheet.href = `/scripts/extensions/third-party/${extensionName}/style.css`;
    document.head.appendChild(styleSheet);

    // 加载音频文件
    loadAudio();

    // 总开关事件监听
    $("#extension_enabled").on("input", onExtensionEnabledToggle);

    // 复选框事件监听
    $("#title_reminder_setting").on("input", onReminderToggle);
    $("#notification_setting").on("input", onNotificationToggle);
    $("#tick_sound_setting").on("input", onTickSoundToggle);
    $("#request_notification_permission").on("click", onRequestPermissionClick);

    // 添加测试声音按钮的事件监听
    $("#test_tick_sound").on("click", onTestTickSoundClick);

    loadSettings();

    // 添加消息事件监听
    eventSource.on(event_types.MESSAGE_RECEIVED, handleNewMessage);

    // 当页面变为可见时，停止闪烁标题
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            stopTitleFlash();
        }
    });

    // 初始化时不自动请求权限，等待用户交互
    if (Notification.permission === "granted") {
        console.log("已具有通知权限");
    }
});
