[中文](/README-zh.md)

# Overview
This is a modal editing extension that works similar to VIM. You can use normal, insert, visual, search modes to edit documents in vscode. It currently provides a simple preset of key bindings that are similar to VIM, called "simple", which is enabled by default. You can change it in the settings.   
This extension is inspired by [ModalEdit](https://github.com/johtela/vscode-modaledit), but it does not support key bindings in insert mode, nor does it support using a dedicated file to store key bindings. These two are important features for me, so I created this extension.

# Settings Options
ModalEx supports some settings options, which you can find in vscode's settings. They are:

 * **preset**: The preset of key bindings that comes with the plugin.   
     * **none**: Empty, no key bindings.
     * **simple**: A simple preset that has similar keys to VIM, enabled by default.
 * **customKeymaps**: The path of the custom key binding json file. The format of the json file will be introduced later.
 * **keymaps**: Key binding settings. Here you can override or add some key bindings. The format of the key bindings will be introduced later.
 * **insertCursorStyle, normalCursorStyle, visualCursorStyle, searchCursorStyle**: The cursor style for different modes. You can choose line, block, underline, etc.
 * **insertTimeout**: The timeout for insert mode. After the timeout, the keys that have been pressed will be treated as normal characters and inserted into the document. If it is less than 0, it will never timeout.

The key bindings in preset, customKeymaps and keymaps are effective at the same time, but they have different priorities: keymaps > customKeymaps > preset. For the same key or key sequence, if there is a key binding in keymaps, the corresponding operation in keymaps will be used first, and the operations in customKeymaps and preset will not be executed.   
insertTimeout only works for keys that have been bound in insert mode. Keys that have not been bound will directly input the corresponding characters without delay.

# Setting Key Bindings
ModalEx supports custom key bindings, which you can find in the vscode settings under the keymaps option, or provide a custom key binding json file.

### Format
``` json
// In the vscode settings file:
{
    ...
    "modalex.keymaps": {
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

// In the customKeymaps file:
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
``` json 
"normal": {
    // Some settings only take effect in normal mode.
    "a": "<command>",           // Press the a key to execute the <command> command.
    "b": {                      // Command with arguments.
        "command": "<command>", // Press the b key to execute the <command> command.
        "args": <any>,          // Optional, use arguments when executing the command.
    },
    "c": [                      // Can be an array of command sequences.
        "<command1>",           // Items in the command sequence can be a string command.
        {                       // Or a command with arguments.
            "command": "<command2>", 
            "args": <any>
        }
    ],
    "d-f": "<command>",         // Press any key between c and f (including c and f) to execute the <command> command.
    "g,h": "<command>",         // Press g or h to execute the <command> command.
    "i,j,k-q,r-t": "<command>", // Can be used in combination.

    "u": {                      // Can be nested.
        "q": "<command>",       // Execute <command> after pressing a followed by q.
        "a-c": {                // Can continue nesting.
            "a": "<command>"
        }
    },
}
```

# Commands
ModalEx provides some control commands and some editing commands.

#### Control commands (can be used in the vscode command palette):
Source code see /src/commands/base.ts
 * **modalex.enable**: Enable the extension.
 * **modalex.disable**: Disable the extension.
 * **modalex.reload**: Reload the extension, if the customKeymaps file content changes, you can use this command to reload. vscode settings changes will automatically reload, no need to use this command.

#### Control commands (cannot be used in vscode command palette):
Source code see /src/commands/base.ts
 * **modalex.enterNormal**: Enter normal mode.
 * **modalex.enterInsert**: Enter insert mode, with the following parameters:
      * **right**: Optional, if true, move the cursor one position to the right when entering insert mode, similar to Vim's "a" key
 * **modalex.enterVisual**: Enter visual mode.
 * **modalex.enterVisualLine**: Enter visual mode, but select by line units.
 * **modalex.enterVisualBlock**: Enter visual mode, but with one cursor per line.
- **modalex.searchCharLineBefore**: Enter search mode, but with searchRange=line, searchDirection=before, singleChar=true. See [About Search Mode](#About-Search-Mode).
- **modalex.searchCharLineAfter**: Enter search mode, but with searchRange=line, searchDirection=after, singleChar=true. See [About Search Mode](#About-Search-Mode).
- **modalex.searchBefore**: Enter search mode, but with searchRange=document, searchDirection=before, singleChar=false. See [About Search Mode](#About-Search-Mode).
- **modalex.searchAfter**: Enter search mode, but with searchRange=document, searchDirection=after, singleChar=false. See [About Search Mode](#About-Search-Mode).
- **modalex.searchNext**: Available in any mode, jump to the next match.
- **modalex.searchPrev**: Available in any mode, jump to the previous match.

#### Editing Commands
These commands provide some useful editing functions, see /src/commands/actions.ts
- **modalex.action.paste**
- **modalex.action.transformToUppercase**: Transforms the character at the cursor position or the characters in the selection to uppercase.
- **modalex.action.transformToLowercase**: Transforms the character at the cursor position or the characters in the selection to lowercase.

## About Search Mode
Search mode cannot set key bindings. After entering this mode, it records all pressed characters and searches for them after pressing the enter key and moves the cursor to the searched position.
Search mode executes different strategies according to the parameters when entering this mode. There are the following parameters:
- **searchRange**: Search range.
    - **line**: Only search within the line where the cursor is located.
    - **document**: Search within the entire document.
- **searchDirection**: Search direction.
    - **before**: Search from the cursor position to the beginning of the file or line.
    - **after**: Search from the cursor position to the end of the file or line.
    - **start**: Search from the beginning of the line or document to the end of the line or document.
    - **reverse**: Search from the end of the line or document to the beginning of the line or document.
- **singleChar**: If true, only search for a single character, without pressing enter.

## About Visual Mode
Visual mode can be used to select text and perform some editing operations.

# LICENSE
MIT
