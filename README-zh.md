[English](/README.md)


# 概述
这是个模态编辑扩展，用起来类似于 VIM，可以在 vscode 中使用 normal，insert，visual，search 模式来编辑文档。目前提供了一个简单的类似于 VIM 的键绑定预设，叫 “simple”，默认启用，可以在设置里修改。   
这个扩展的灵感来自于 [ModalEdit](https://github.com/johtela/vscode-modaledit)，但是它不支持在 insert 模式下进行键绑定，也不支持使用专门的文件来放置键绑定，这两个是对我比较重要的两个功能，所以便有了这个扩展。


# 设置选项
ModalEx 支持一些设置选项，可以在vscode的设置中找到它们。它们分别是：

 * **preset**: 插件自带的键绑定预设。   
     * **none**: 空，没有任何键绑定。
     * **simple**: 一个简单的，键位类似于 VIM 的预设，默认启用。
 * **customKeymaps**: 自定义的键绑定json文件的路径。json文件的格式后面会介绍。
 * **keymaps**: 键绑定设置。这里你可以覆盖或者添加一些键绑定，键绑定的格式后面会介绍。
 * **insertCursorStyle, normalCursorStyle, visualCursorStyle, searchCursorStyle**: 不同模式下的光标样式。你可以选择line, block，underline等。
 * **insertTimeout**: insert 模式下的超时时间，超时后已经按下的键将视作普通字符插入文档，小于0则永不超时。

preset、customKeymaps 和 keymaps 中的键绑定同时生效，但是它们之间存在优先级：keymaps > customKeymaps > preset。对于同一个键或键序列，如果keymaps里存在键绑定，则优先使用 keymaps 里对应的操作，而不会执行 customKeymaps、preset 里的操作。   
insertTimeout 只对 insert 模式下进行了绑定的键有效，没有进行键绑定的键会直接输入对应的字符，不会有延迟。

# 设置键绑定
ModalEx支持自定义键绑定，你可以在vscode的设置中找到keymaps选项，或者提供一个自定义的键绑定json文件。

### 格式
``` jsonc
// 在 vscode 设置文件里：
{
    ...
    “modalex.keymaps”: {
        "insert": {
            ...
        },
        "normal": {
            ...
        },
        "visual": {
            ...
        }
    }
    ...
}

// 在 customKeymaps 文件里：
{
    "insert": {
        ...
    },
    "normal": {
        ...
    },
    "visual": {
        ...
    }
}
```
``` jsonc
"normal": {
    // 一些设置仅在 normal 模式下生效。
    "a": "<command>",           // 按下 a 键，执行 <command> 命令。
    "b": {                      // 带参数的命令。
        "command": "<command>", // 按下 b 键，执行 <command> 命令。
        "args": "<any>"         // 可选，执行命令时使用参数。
    },
    "c": [                      // 可以是一个数组组成的命令序列。
        "<command1>",           // 命令序列里的项可以是一个字符串命令。
        {                       // 也可以是带参数的命令。
            "command": "<command2>", 
            "args": "<any>"
        }
    ],
    "d-f": "<command>",         // 按下 c 到 f 之间的任意键（包含 c 和 f），执行 <command> 命令。
    "g,h": "<command>",         // 按下 g 或 h 键，执行 <command> 命令。
    "i,j,k-q,r-t": "<command>", // 可用组合使用。

    "u": {                      // 可以嵌套使用。
        "q": "<command>",       // 当按下 a 后再按下 q 后执行 <command>。
        "a-c": {                // 可以继续嵌套。
            "a": "<command>"
        }
    },
}
```

# 命令
ModalEx 提供了一些控制命令和一些编辑命令。

#### 控制命令（可以在 vscode 命令面板中使用）:
源代码见 /src/commands/base.ts   
 * **modalex.enable**: 开启扩展。
 * **modalex.disable**: 关闭扩展。
 * **modalex.reload**: 重新加载扩展，如果 customKeymaps 文件的内容发生改变，可以使用该命令重新加载。vscode 的设置发生改变时会自动重新加载，无需使用该命令。

#### 控制命令（不能在 vscode 命令面板中使用）:
源代码见 /src/commands/base.ts   
 * **modalex.enterNormal**: 进入到 normal 模式。
 * **modalex.enterInsert**: 进入到 insert 模式，有如下参数：
      * **right**: 可选，如果为 true，则进入插入模式时把光标向右移动一位，类似于 VIM 的"a"键
 * **modalex.enterVisual**: 进入到 visual 模式。
 * **modalex.enterVisualLine**: 进入到 visual 模式，但是选择的时候以行为单位。
 * **modalex.enterVisualBlock**: 进入到 visual 模式，但是每行一个光标。
 * **modalex.searchCharLineBefore**: 进入到 search 模式，但是 searchRange=line, searchDirection=before, singleChar=true，详见[关于 search 模态](#关于-search-模态)。
 * **modalex.searchCharLineAfter**: 进入到 search 模式，但是 searchRange=line, searchDirection=after, singleChar=true，详见[关于 search 模态](#关于-search-模态)。
 * **modalex.searchBefore**: 进入到 search 模式，但是 searchRange=document, searchDirection=before, singleChar=false，[关于 search 模态](#关于-search-模态)。
 * **modalex.searchAfter**: 进入到 search 模式，但是 searchRange=document, searchDirection=after, singleChar=false，[关于 search 模态](#关于-search-模态)。
 * **modalex.searchNext**: 任意模式可用，跳转到下一个匹配的位置。
 * **modalex.searchPrev**: 任意模式可用，跳转到上一个匹配的位置。

#### 编辑命令
这些命令提供一些实用的编辑功能，见 /src/commands/actions.ts   
 * **modalex.action.paste**
 * **modalex.action.transformToUppercase**: 把光标所在位置的字符或者选择区域的字符转换为大写。
 * **modalex.action.transformToLowercase**: 把光标所在位置的字符或者选择区域的字符转换为小写。

## 关于 search 模态
search 模式不能设置键绑定，进入该模式后会记录所有按下字符，在按下回车键后进行搜索并把光标移动到搜索到的位置。   
search 模式会根据进入该模式时的参数执行不同的策略，有如下参数：
 * **searchRange**: 搜索范围。
     * **line**: 只在光标所在的行内搜索。
     * **document**: 在整个文档内搜索。
 * **searchDirection**: 搜索方向。
     * **before**: 从光标所在的位置往文件开头或行的开头处搜索。
     * **after**: 从光标所在的位置往文件结尾或行的结尾处搜索。
     * **start**：从行或文档的开头往行或文档的结尾处搜索。
     * **reverse**：从行或文档的结尾往行或文档的开头处搜索。
 * **singleChar**: 如果为 true，仅搜索单个字符，而不需要按回车键。

## 关于 visual 模态
visual模态可以用来选中文本，还可以用来执行一些编辑操作。

# LICENSE
MIT