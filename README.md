[中文](/README-zh.md)

# Overview
ModalEx is an extension that brings modal editing to Visual Studio Code (VSCode), similar to Vim's modal editing. It allows you to use normal, insert, visual, and search modes for editing documents.   

ModalEx supports keybindings in normal, insert, and visual modes (search mode does not currently support keybindings) and allows you to define custom keybindings in separate files.   

The extension comes with a built-in keybinding preset called "simple," which resembles Vim's keybindings. By default, this preset is enabled, but you can modify it in the settings.   

# Configuration Options
ModalEx provides several configuration options that you can find in VSCode's settings:

1. **Preset**: Choose from the following built-in keybinding presets:
   - **none**: No keybindings.
   - **simple**: A simple preset with Vim-like keybindings (enabled by default).
2. **CustomKeymaps**: Specify the path to a custom keybindings JSON file.
3. **Keymaps**: Define your own keybindings. You can override or add keybindings here.
 * **insertCursorStyle, normalCursorStyle, visualCursorStyle, searchCursorStyle**:  Set different cursor styles for each mode (insert, normal, visual, and search).
5. **InsertTimeout**: Specify the timeout for insert mode. After this timeout, any keys pressed will be treated as regular characters. If the timeout is less than 0, it will wait indefinitely.

Keybindings from preset, customKeymaps, and keymaps will all take effect, with the following priority: keymaps > customKeymaps > preset. If a keybinding exists in keymaps, it will override any corresponding actions in customKeymaps or the preset. The insertTimeout only affects keys that have specific bindings in insert mode; keys without bindings will directly input their corresponding characters without delay.

# Customizing Keybindings
You can customize keybindings by either modifying the keymaps option in VSCode settings or providing a custom keybindings JSON file. Both formats follow the same structure:

### Format
```jsonc
// In VSCode settings:
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
```jsonc
// In a customKeymaps file:
{
    "insert": <Keymap>,
    "normal": <Keymap>,
    "visual": <Keymap>
}
```
```typescript
type Command = string | { command: string, args?: any };
type CommandList = Command[];
type KeymapTarget = { target: string };

type Keymap = {
    id?: string,
    help?: string,
    [key: string]: Command | CommandList | Keymap | KeymapTarget,
}
```

### Example
```jsonc
"normal": {
    // Some settings apply only in normal mode.
    "a": "<command>",           // Pressing 'a' executes the '<command>' action.
    "b": {                      // Command with parameters.
        "command": "<command>", // Pressing 'b' executes the '<command>' action.
        "args": "<any>"         // Optional argument for the command (can be any JSON value).
    },
    "c": [                      // An array of commands.
        "<command1>",           // Items in the command sequence can be simple strings.
        {                       // Or commands with parameters.
            "command": "<command2>", 
            "args": "<any>"     
        }
    ],
    "u": {                      // Nesting commands.
        "q": "<command>",       // After pressing 'a', then 'q', execute '<command>'.
    },
}
```

### Help Field
The "help" field provides a description and comments for the keymap.

### id and target fields
TODO

# Commands
ModalEx provides some control commands and some editing commands.

#### Control commands (can be used in the vscode command palette):
Source code: /src/commands/base.ts   
 * **modalex.enable**: Enable modal editing functionality.
 * **modalex.disable**: Disable modal editing functionality.
 * **modalex.reload**: Reload the extension, useful if the content of the customKeymaps file changes. The extension will automatically reload when vscode settings change, so this command is not necessary.
 * **modalex.editCustomKeymaps**: Open the custom keymaps file for modification (if custom keymaps are set).

#### Control commands (cannot be used in the vscode command palette):
Source code: /src/commands/base.ts   
 * **modalex.enterNormal**: Enter normal mode.
 * **modalex.enterInsert**: Enter insert mode, with the following parameters:
      * **right**: Optional, if true, moves the cursor one position to the right when entering insert mode, similar to Vim's "a" key
 * **modalex.enterVisual**: Enter visual mode.
 * **modalex.enterVisualLine**: Enter visual mode, but select by line.
 * **modalex.enterVisualBlock**: Enter visual mode, but with one cursor per line.
 * **modalex.enterSearchCharLineBefore**: Enter search mode, but with searchRange=line, searchDirection=before, singleChar=true, see [About search mode](#about-search-mode).
 * **modalex.enterSearchCharLineAfter**: Enter search mode, but with searchRange=line, searchDirection=after, singleChar=true, see [About search mode](#about-search-mode).
 * **modalex.enterSearchBefore**: Enter search mode, but with searchRange=document, searchDirection=before, singleChar=false, see [About search mode](#about-search-mode).
 * **modalex.enterSearchAfter**: Enter search mode, but with searchRange=document, searchDirection=after, singleChar=false, see [About search mode](#about-search-mode).
 * **modalex.searchNext**: Available in any mode, jumps to the next matching position.
 * **modalex.searchPrev**: Available in any mode, jumps to the previous matching position.

#### Editing commands
These commands provide practical editing features, see /src/commands/actions.ts   
 * **modalex.action.paste**
 * **modalex.action.transformToUppercase**: Converts the character at the cursor position or the selected region to uppercase.
 * **modalex.action.transformToLowercase**: Converts the character at the cursor position or the selected region to lowercase.

## About search mode
Search mode does not allow key bindings. When entering this mode, all pressed characters are recorded, and the cursor is moved to the search result upon pressing the Enter key.   
Search mode executes different strategies based on the parameters when entering this mode, with the following parameters:
 * **searchRange**: Search range.
     * **line**: Searches only within the line where the cursor is located.
     * **document**: Searches throughout the entire document.
 * **searchDirection**: Search direction.
     * **before**: Searches from the cursor's position to the beginning of the file or line.
     * **after**: Searches from the cursor's position to the end of the file or line.
     * **start**: Searches from the beginning of the line or document to the end.
     * **reverse**: Searches from the end of the line or document to the beginning.
 * **singleChar**: If true, searches for a single character, jumping to the target position after pressing a character without needing to press Enter.

## About visual mode
TODO

# LICENSE
MIT
