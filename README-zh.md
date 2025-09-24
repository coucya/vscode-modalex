[English](/README.md)

# 概述
这是一个模态编辑扩展，类似于 Vim 下的模态编辑，可以在 vscode 中使用 normal，insert，visual，search 模态编辑文档。
支持在 normal，insert，visual 模态下进行键绑定（search 模态下暂不支持），支持使用单独的文件放置键绑定。
目前提供了一个简单的类似于 VIM 的键绑定预设，叫 "simple"，默认启用，可以在设置里修改。


# 设置选项
ModalEx 支持以下设置选项，可以在vscode的设置中找到它们。它们分别是：

 * **preset**: 插件自带的键绑定预设配置。
     * **none**: 空白预设，不包含任何键位映射，适用于需要完全自定义键绑定配置的高级用户。
     * **simple**: 基础预设，实现类 Vim 的核心键位映射机制，作为系统默认预设启用，适用于熟悉 Vim 操作模式的用户。
 * **customKeymaps**: 指向外部自定义键绑定 JSON 配置文件的路径。该配置文件中的键绑定定义将覆盖预设配置中的相应定义。
 * **keymaps**: 在 VSCode 用户设置中直接定义的键绑定配置项，具有最高优先级，其定义将覆盖预设配置及外部自定义文件中的相应定义。
 * **insertCursorStyle, normalCursorStyle, visualCursorStyle, searchCursorStyle**: 分别指定 insert、normal、visual 和 search 四种编辑模态下的光标显示样式。支持的光标样式包括 "line"（线条）、"block"（方块）、"underline"（下划线）和 "line-thin"（细线）等多种类型。
 * **insertTimeout**: 设定 insert 模态下的键输入序列超时阈值（单位：毫秒）。当超过指定时间未完成键序列输入时，已输入的键序列将被系统解析为普通字符插入文档。当设定值小于 0 时，表示禁用超时检测机制，系统将持续等待直至获取完整的键序列输入。

preset、customKeymaps 和 keymaps 中的键绑定配置将同时生效，但配置项之间存在明确的优先级关系：keymaps > customKeymaps > preset。对于同一键位或键序列，若 keymaps 中存在对应定义，则系统将优先执行该定义，而不会执行 customKeymaps 或 preset 中的相应定义。
insertTimeout 配置仅对 insert 模态下已定义键绑定的按键序列有效。对于未进行键绑定的按键，系统将直接将其作为普通字符插入文档，不存在任何延迟机制。

# 设置键绑定
ModalEx支持自定义键绑定，你可以在vscode的设置中找到keymaps选项，或者提供一个自定义的键绑定json文件。它们都使用相同的格式。

### 格式
``` jsonc
// 在 vscode 设置文件里：
{
    ...
    "modalex.keymaps": {
        "insert": <Keymap>,
        "normal": <Keymap>,
        "visual": <Keymap>
    }
    ...
}
```
``` jsonc
// 在 customKeymaps 文件里：
{
    "insert": <Keymap>,
    "normal": <Keymap>,
    "visual": <Keymap>
}
```
``` typescript
type Command = string | { command: string, args?: any };
type CommandList = Command[];
type KeymapTarget = { target: string };

type Keymap = {
    id?: string,
    help?: string,
    [key: string]: Command | CommandList | Keymap | KeymapTarget,
}
```

### 例子
``` jsonc
"normal": {
    // 一些设置仅在 normal 模态下生效。
    "a": "<command>",           // 按下 a 键，执行 <command> 命令。
    "b": {                      // 带参数的命令。
        "command": "<command>", // 按下 b 键，执行 <command> 命令。
        "args": "<any>"         // 可选，执行命令时使用参数，可以是任何 json 值。
    },
    "c": [                      // 可以是一个数组组成的命令序列，命令序列依次执行。
        "<command1>",           // 命令序列里的项可以是一个字符串命令。
        {                       // 也可以是带参数的命令。
            "command": "<command2>",
            "args": "<any>"
        }
    ],
    "u": {                      // 可以嵌套使用。
        "q": "<command>",       // 当按下 a 后再按下 q 后执行 <command>。
    },
}
```
### help 字段
help 字段用于描述和注释这个 Keymap。

### id 与 target 字段
TODO


# 模态

## 关于 search 模态
search 模态不能设置键绑定，进入该模态后会记录所有按下字符，在按下回车键后进行搜索并把光标移动到搜索到的位置。
search 模态会根据进入该模态时的参数执行不同的策略，有如下参数：
 * **searchRange**: 搜索范围。
     * **line**: 只在光标所在的行内搜索。
     * **document**: 在整个文档内搜索。
 * **searchDirection**: 搜索方向。
     * **before**: 从光标所在的位置往文件开头或行的开头处搜索。
     * **after**: 从光标所在的位置往文件结尾或行的结尾处搜索。
     * **start**：从行或文档的开头往行往文档的结尾处搜索。
     * **reverse**：从行或文档的结尾往行往文档的开头处搜索。
 * **singleChar**: 如果为 true，仅搜索单个字符，在按下一个字符后就跳转到目标位置而不需要按回车键。

## 关于 visual 模态
TODO


# 命令
ModalEx 提供了一些控制命令和一些编辑命令。

#### vscode 命令面板:
源代码见 /src/commands/base.ts
 * **Enable ModalEx**: 开启模态编辑功能。
 * **Disable ModalEx**: 关闭模态编辑功能。
 * **ModalEx reload config**: 重新加载扩展，如果 customKeymaps 文件的内容发生改变，可以使用该命令重新加载。vscode 的设置发生改变时会自动重新加载，无需使用该命令。
 * **ModalEx edit custom keymaps**: 打开自定义键映射文件以进行修改。

#### 控制命令（可以用于键绑定）:
源代码见 /src/commands/base.ts
 * **modalex.enable**: 开启模态编辑功能。
 * **modalex.disable**: 关闭模态编辑功能。
 * **modalex.reload**: 重新加载扩展，如果 customKeymaps 文件的内容发生改变，可以使用该命令重新加载。vscode 的设置发生改变时会自动重新加载，无需使用该命令。
 * **modalex.editCustomKeymaps**: 打开自定义键映射文件以进行修改。
 * **modalex.enterNormal**: 进入到 normal 模态。
 * **modalex.enterInsert**: 进入到 insert 模态，有如下参数：
      * **right**: 可选，如果为 true，则进入插入模态时把光标向右移动一位，类似于 Vim 的"a"键
 * **modalex.enterInsertRight**: 进入到 insert 模态，并将光标向右移动一位，等同于 `modalex.enterInsert` 参数为 `{right: true}`。
 * **modalex.enterVisual**: 进入到 visual 模态。
 * **modalex.enterVisualLine**: 进入到 visual 模态，但是选择的时候以行为单位。
 * **modalex.enterVisualBlock**: 进入到 visual 模态，但是每行一个光标。
 * **modalex.enterSearchCharLineBefore**: 进入到 search 模态，用于在当前行光标位置向前搜索单个字符。按下字符后会立即跳转到该字符位置，无需按回车键。
 * **modalex.enterSearchCharLineAfter**: 进入到 search 模态，用于在当前行光标位置向后搜索单个字符。按下字符后会立即跳转到该字符位置，无需按回车键。
 * **modalex.enterSearchBefore**: 进入到 search 模态，用于在整个文档中从光标位置向前搜索文本。需要输入完整搜索词并按回车键执行搜索。
 * **modalex.enterSearchAfter**: 进入到 search 模态，用于在整个文档中从光标位置向后搜索文本。需要输入完整搜索词并按回车键执行搜索。
 * **modalex.searchNext**: 任意模态可用，跳转到下一个匹配的位置。
 * **modalex.searchPrev**: 任意模态可用，跳转到上一个匹配的位置。

#### 编辑命令（可以用于键绑定）:
这些命令提供一些实用的编辑功能，见 /src/commands/actions.ts
 * **modalex.action.yank**: 复制选中的文本到剪贴板。
 * **modalex.action.cut**: 剪切选中的文本到剪贴板。
 * **modalex.action.yankLine**: 复制当前行到剪贴板，包括行尾换行符。
 * **modalex.action.cutLine**: 剪切当前行到剪贴板，包括行尾换行符。
 * **modalex.action.paste**: 在光标位置粘贴剪贴板内容。支持以下参数：
      * **before**: 可选，如果为 true，则在光标位置前粘贴，否则在光标位置后粘贴。
      * **enterNormal**: 可选，如果为 true，粘贴后自动进入 normal 模态。
 * **modalex.action.transformToUppercase**: 把光标所在位置的字符或者选择区域的字符转换为大写。
 * **modalex.action.transformToLowercase**: 把光标所在位置的字符或者选择区域的字符转换为小写。
 * **modalex.action.cursorUpSelect**: 在 visual 模态下，将光标向上移动并扩展选择区域。
 * **modalex.action.cursorDownSelect**: 在 visual 模态下，将光标向下移动并扩展选择区域。
 * **modalex.action.cursorLeftSelect**: 在 visual 模态下，将光标向左移动并扩展选择区域。
 * **modalex.action.cursorRightSelect**: 在 visual 模态下，将光标向右移动并扩展选择区域。


# LICENSE
MIT
