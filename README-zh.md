[English](/README.md)

# 概述

ModalEx 是一款基于模态编辑理念的 Visual Studio Code 扩展，其设计灵感来源于 Vim 编辑器。该扩展为 VSCode 提供了 Normal、Insert、Visual 和 Search 四种编辑模式。

本扩展支持在 Normal、Insert 和 Visual 模式下进行自定义键位绑定配置（Search 模式暂不支持自定义键位），并允许通过独立的配置文件管理键位映射关系。

# 配置选项

ModalEx 提供多项配置参数，用户可通过 Visual Studio Code 的设置界面进行配置。具体配置选项如下：

* **preset**：指定扩展内置的键位预设配置。
  * **none**：空白预设，不包含任何键位映射，适用于需要完全自定义键位配置的高级用户。
  * **simple**：基础预设，实现 Vim 风格的核心键位映射机制，作为系统默认预设启用，适用于熟悉 Vim 操作模式的用户。

* **customKeymaps**：指定外部自定义键位映射 JSON 配置文件的路径。该配置文件中的键位定义将覆盖预设配置中的相应定义。

* **keymaps**：在 VSCode 用户设置中直接定义的键位配置项，具有最高优先级，其定义将覆盖预设配置及外部自定义文件中的相应定义。

* **insertCursorStyle、normalCursorStyle、visualCursorStyle、searchCursorStyle**：分别指定 Insert、Normal、Visual 和 Search 四种编辑模式下的光标显示样式。支持的光标样式包括 "line"（线条）、"block"（方块）、"underline"（下划线）和 "line-thin"（细线）等多种类型。

* **insertTimeout**：设定 Insert 模式下的键位输入序列超时阈值（单位：毫秒）。当超过指定时间未完成键位序列输入时，已输入的键位序列将被系统解析为普通字符并插入文档。当设定值小于 0 时，表示禁用超时检测机制，系统将持续等待直至获取完整的键位序列输入。

预设配置（preset）、自定义键位文件（customKeymaps）和直接设置（keymaps）中的键位配置将同时生效，但配置项之间存在明确的优先级关系：**keymaps > customKeymaps > preset**。对于同一键位或键位序列，若 keymaps 中存在对应定义，则系统将优先执行该定义，而不会执行 customKeymaps 或 preset 中的相应定义。

insertTimeout 配置仅对 Insert 模式下已定义键绑定的按键序列有效。对于未进行键绑定的按键，系统将直接将其作为普通字符插入文档，不存在任何延迟机制。

# 键位绑定配置

ModalEx 支持通过以下两种方式自定义键位绑定：

1. 在 VSCode 设置中直接配置 `modalex.keymaps` 选项
2. 提供独立的 JSON 文件作为自定义键位绑定配置

上述两种方式采用相同的配置格式，均支持为 Insert、Normal 和 Visual 三种模式定义不同的键位绑定。

## 配置格式

键位绑定配置采用 JSON 格式，支持以下数据结构：

### 基本命令格式

```jsonc
// 在 VSCode 设置文件中：
{
    "modalex.keymaps": {
        "insert": { /* insert 模式下的键位绑定 */ },
        "normal": { /* normal 模式下的键位绑定 */ },
        "visual": { /* visual 模式下的键位绑定 */ }
    }
}
```

```jsonc
// 在单独的自定义键位绑定文件中：
{
    "insert": { /* insert 模式下的键位绑定 */ },
    "normal": { /* normal 模式下的键位绑定 */ },
    "visual": { /* visual 模式下的键位绑定 */ }
}
```

## `Simple` 预设键位配置

ModalEx 内置的 "simple" 预设提供了一套类似 Vim 的基础键位配置，默认启用。该预设定义了以下主要键位绑定：

### Normal 模式
* `h` - 向左移动光标
* `j` - 向下移动光标
* `k` - 向上移动光标
* `l` - 向右移动光标
* `i` - 进入 Insert 模式
* `a` - 进入 Insert 模式并将光标向右移动一位
* `v` - 进入 Visual 模式
* `V` - 进入 Visual Line 模式
* `x` - 删除光标右侧字符
* `X` - 删除光标左侧字符
* `w` - 移动到下一个单词开头
* `W` - 移动到下一个单词开头
* `b` - 移动到上一个单词开头
* `B` - 移动到上一个单词开头
* `e` - 移动到下一个单词结尾
* `E` - 移动到下一个单词结尾
* `o` - 在当前行下方新建一行并进入 Insert 模式
* `O` - 在当前行上方新建一行并进入 Insert 模式
* `dd` - 删除当前行并复制到剪贴板
* `yy` - 复制当前行到剪贴板
* `p` - 在光标后粘贴剪贴板内容，如果被粘贴的内容为一行文本（即用 `yy` 复制的），则在粘贴到光标所在行的下一行
* `P` - 在光标后粘贴剪贴板内容，如果被粘贴的内容为一行文本（即用 `yy` 复制的），则在粘贴到光标所在行的前一行
* `db` - 删除前一个单词
* `de` - 删除到单词结尾
* `dw` - 删除后一个单词
* `f` - 向前搜索单个字符
* `F` - 向后搜索单个字符
* `/` - 向前搜索文本
* `?` - 向后搜索文本
* `n` - 跳转到下一个搜索结果
* `N` - 跳转到上一个搜索结果
* `u` - 撤销操作

### Visual 模式
* `h` - 向左扩展选择区域
* `j` - 向下扩展选择区域
* `k` - 向上扩展选择区域
* `l` - 向右扩展选择区域
* `w` - 按单词向右扩展选择区域
* `e` - 扩展到单词结尾
* `b` - 按单词向左扩展选择区域
* `I` - 在选中区域开头进入 Insert 模式
* `A` - 在选中区域结尾进入 Insert 模式
* `y` - 复制选中内容并返回 Normal 模式
* `Y` - 复制选中内容并返回 Normal 模式
* `d` - 剪切选中内容并返回 Normal 模式
* `x` - 剪切选中内容并返回 Normal 模式
* `p` - 粘贴剪贴板内容并返回 Normal 模式
* `s` - 剪切选中内容并进入 Insert 模式
* `f` - 向前搜索单个字符
* `F` - 向后搜索单个字符

### Insert 模式
Simple 预设中 Insert 模式键位为空，用户可通过自定义配置设置返回 Normal 模式的按键。

## 配置示例

ModalEx 支持多种键位绑定方式，主要包括以下几种类型：

1. **单键绑定**：将单个按键直接映射到 ModalEx 命令
2. **命令序列**：将多个命令组合在一起，按顺序执行
3. **组合键**：通过按键组合实现更丰富的功能，例如使用 "yy" 组合键复制当前行

以下是一个 Normal 模式下的键位绑定配置示例，展示了上述几种绑定方式的具体应用：

```jsonc
"normal": {
    // 基本命令绑定：单个键位绑定到单个 ModalEx 命令
    "y": "modalex.action.yank",           // 按下 y 键，复制选中的文本
    "x": "modalex.action.cut",            // 按下 x 键，剪切选中的文本
    "p": "modalex.action.paste",          // 按下 p 键，粘贴剪贴板内容
    
    // 带参数的命令绑定：单个键位绑定到带参数的 ModalEx 命令
    "P": {
        "command": "modalex.action.paste",  // 按下 P 键，在光标前粘贴剪贴板内容
        "args": {
            "before": true                  // 在光标位置前粘贴
        }
    },
    
    // 命令序列：单个键位绑定到多个 ModalEx 命令，按顺序执行
    "o": [
        "editor.action.insertLineAfter",     // 按下 o 键，在光标所在行下方插入新行
        "modalex.enterInsert"                // 进入 Insert 模式
    ],
    
    // 嵌套键位映射：组合键的使用
    "d": {
        "d": "modalex.action.deleteAndYankLine",    // 按下 d 键后再按 d 键，删除当前整行
        "w": "deleteWordRight"                      // 按下 d 键后再按 w 键，删除单词
        "x": {
            ...                                     // 同理，可以继续嵌套
        }
    },
    
    // 模式切换命令
    "i": "modalex.enterInsert",               // 按下 i 键，进入 Insert 模式
    "a": "modalex.enterInsertRight",          // 按下 a 键，进入 Insert 模式并将光标右移
    "v": "modalex.enterVisual",               // 按下 v 键，进入 Visual 模式
    "V": "modalex.enterVisualLine"            // 按下 V 键，进入 Visual Line 模式
}
```

**注意**：带参数的命令绑定和嵌套键位映射不能同时存在，以下配置方式无效：

```jsonc
"normal": {
    "d": {
        "command": "editor.action.deleteLines",
        "args": { "lines": 2 },
        "d": "editor.action.deleteLines",
        "y": "editor.action.copyLinesDownAction"
    }
}
```

# 模式说明

## Search 模式

Search 模式不支持自定义键位绑定。进入该模式后，系统将记录所有输入的字符，在按下回车键后执行搜索并将光标定位到匹配位置。

Search 模式根据进入时的参数采用不同的搜索策略，支持以下参数：

* **searchRange**：搜索范围。
  * **line**：仅在光标所在的行内搜索
  * **document**：在整个文档内搜索

* **searchDirection**：搜索方向。
  * **before**：从光标所在位置向文件开头或行开头方向搜索
  * **after**：从光标所在位置向文件结尾或行结尾方向搜索
  * **start**：从行或文档开头向结尾方向搜索
  * **reverse**：从行或文档结尾向开头方向搜索

* **singleChar**：如果为 true，仅搜索单个字符，在按下一个字符后立即跳转到目标位置，无需按回车键。

## Visual 模式

TODO

# 命令

ModalEx 提供控制命令和编辑命令两类功能。

## VSCode 命令面板

源代码见 [`/src/commands/base.ts`](src/commands/base.ts)

* **Enable ModalEx**：开启模态编辑功能
* **Disable ModalEx**：关闭模态编辑功能
* **ModalEx reload config**：重新加载扩展配置。当 customKeymaps 文件内容发生变更时，可使用该命令重新加载。VSCode 设置发生变更时会自动重新加载，无需使用该命令
* **ModalEx edit custom keymaps**：打开自定义键映射文件以进行修改

## 控制命令（可用于键绑定）

源代码见 [`/src/commands/base.ts`](src/commands/base.ts)

* **modalex.enable**：开启模态编辑功能
* **modalex.disable**：关闭模态编辑功能
* **modalex.reload**：重新加载扩展配置。当 customKeymaps 文件内容发生变更时，可使用该命令重新加载。VSCode 设置发生变更时会自动重新加载，无需使用该命令
* **modalex.editCustomKeymaps**：打开自定义键映射文件以进行修改
* **modalex.enterNormal**：进入 Normal 模式
* **modalex.enterInsert**：进入 Insert 模式，支持以下参数：
  * **right**（可选）：如果为 true，则进入插入模式时将光标向右移动一位，类似于 Vim 的 "a" 键功能
* **modalex.enterInsertRight**：进入 Insert 模式，并将光标向右移动一位，等同于 `modalex.enterInsert` 参数为 `{right: true}`
* **modalex.enterVisual**：进入 Visual 模式
* **modalex.enterVisualLine**：进入 Visual 模式，但选择时以行为单位
* **modalex.enterVisualBlock**：进入 Visual 模式，但在每行创建一个光标
* **modalex.enterSearchCharLineBefore**：进入 Search 模式，用于在当前行光标位置向前搜索单个字符。按下字符后立即跳转到该字符位置，无需按回车键
* **modalex.enterSearchCharLineAfter**：进入 Search 模式，用于在当前行光标位置向后搜索单个字符。按下字符后立即跳转到该字符位置，无需按回车键
* **modalex.enterSearchBefore**：进入 Search 模式，用于在整个文档中从光标位置向前搜索文本。需要输入完整搜索词并按回车键执行搜索
* **modalex.enterSearchAfter**：进入 Search 模式，用于在整个文档中从光标位置向后搜索文本。需要输入完整搜索词并按回车键执行搜索
* **modalex.searchNext**：任意模式下均可使用，跳转到下一个匹配位置
* **modalex.searchPrev**：任意模式下均可使用，跳转到上一个匹配位置

## 编辑命令（可用于键绑定）

这些命令提供实用的编辑功能，源代码见 [`/src/commands/actions.ts`](src/commands/actions.ts)

* **modalex.action.yank**：将选中的文本复制到剪贴板
* **modalex.action.cut**：将选中的文本剪切到剪贴板
* **modalex.action.yankLine**：复制当前行到剪贴板，包括行尾换行符
* **modalex.action.cutLine**：剪切当前行到剪贴板，包括行尾换行符
* **modalex.action.paste**：在光标位置粘贴剪贴板内容。支持以下参数：
  * **before**（可选）：如果为 true，则在光标位置前粘贴；否则在光标位置后粘贴
  * **enterNormal**（可选）：如果为 true，粘贴后自动进入 Normal 模式
* **modalex.action.transformToUppercase**：将光标所在位置的字符或选定区域的字符转换为大写
* **modalex.action.transformToLowercase**：将光标所在位置的字符或选定区域的字符转换为小写
* **modalex.action.cursorUpSelect**：在 Visual 模式下，将光标向上移动并扩展选择区域
* **modalex.action.cursorDownSelect**：在 Visual 模式下，将光标向下移动并扩展选择区域
* **modalex.action.cursorLeftSelect**：在 Visual 模式下，将光标向左移动并扩展选择区域
* **modalex.action.cursorRightSelect**：在 Visual 模式下，将光标向右移动并扩展选择区域

# 许可证

MIT License
