[中文](/README-zh.md)

# Overview
ModalEx is a Visual Studio Code extension based on modal editing concept, designed with inspiration from the Vim editor. This extension provides four editing modes for VSCode: Normal, Insert, Visual, and Search.

This extension supports custom key binding configuration in Normal, Insert, and Visual modes (Search mode currently does not support custom key bindings), and allows managing key mapping relationships through independent configuration files.

# Configuration Options

ModalEx provides multiple configuration parameters that users can configure through the Visual Studio Code settings interface. The specific configuration options are as follows:

* **preset**: Specifies the built-in key preset configuration for the extension.
  * **none**: Blank preset, containing no key mappings, suitable for advanced users who need completely custom key configurations.
  * **simple**: Basic preset that implements core Vim-style key mapping mechanisms, enabled as the system default preset, suitable for users familiar with Vim operation modes.

* **customKeymaps**: Specifies the path to an external custom key mapping JSON configuration file. Key definitions in this configuration file will override the corresponding definitions in preset configurations.

* **keymaps**: Key configuration items defined directly in VSCode user settings, with the highest priority. Their definitions will override corresponding definitions in preset configurations and external custom files.

* **insertCursorStyle, normalCursorStyle, visualCursorStyle, searchCursorStyle**: Specifies the cursor display style for Insert, Normal, Visual, and Search editing modes respectively. Supported cursor styles include "line" (line), "block" (block), "underline" (underline), and "line-thin" (thin line), and other types.

* **insertTimeout**: Sets the key input sequence timeout threshold in Insert mode (unit: milliseconds). When the specified time is exceeded without completing the key sequence input, the entered key sequence will be parsed as regular characters and inserted into the document. When the set value is less than 0, it means disabling the timeout detection mechanism, and the system will continue to wait until a complete key sequence input is obtained.

The key configurations in preset configuration (preset), custom key files (customKeymaps), and direct settings (keymaps) will take effect simultaneously, but there is a clear priority relationship between configuration items: **keymaps > customKeymaps > preset**. For the same key or key sequence, if there is a corresponding definition in keymaps, the system will prioritize executing that definition and will not execute the corresponding definitions in customKeymaps or preset.

The insertTimeout configuration is only valid for key sequences with defined key bindings in Insert mode. For keys that are not key-bound, the system will directly insert them as regular characters into the document without any delay mechanism.

# Key Binding Configuration

ModalEx supports custom key bindings through the following two methods:

1. Directly configure the `modalex.keymaps` option in VSCode settings
2. Provide an independent JSON file as a custom key binding configuration

The above two methods use the same configuration format and support defining different key bindings for Insert, Normal, and Visual modes.

## Configuration Format

Key binding configuration uses JSON format and supports the following data structure:

### Basic Command Format

```jsonc
// In VSCode settings file:
{
    "modalex.keymaps": {
        "insert": { /* key bindings in insert mode */ },
        "normal": { /* key bindings in normal mode */ },
        "visual": { /* key bindings in visual mode */ }
    }
}
```

```jsonc
// In a separate custom key binding file:
{
    "insert": { /* key bindings in insert mode */ },
    "normal": { /* key bindings in normal mode */ },
    "visual": { /* key bindings in visual mode */ }
}
```

## Configuration Examples

ModalEx supports various key binding methods, mainly including the following types:

1. **Single Key Binding**: Directly map a single key to a VSCode command
2. **Command Sequence**: Combine multiple commands together and execute them in sequence
3. **Combination Keys**: Implement richer functionality through key combinations, such as using "yy" combination key to copy current line

The following is a key binding configuration example in Normal mode, showing the specific application of the above binding methods:

```jsonc
"normal": {
    // Basic command binding: single key bound to a single ModalEx command
    "y": "modalex.action.yank",           // Press y key to copy selected text
    "x": "modalex.action.cut",            // Press x key to cut selected text
    "p": "modalex.action.paste",          // Press p key to paste clipboard content
    
    // Command with parameters: single key bound to a ModalEx command with parameters
    "P": {
        "command": "modalex.action.paste",  // Press P key to paste clipboard content before cursor
        "args": {
            "before": true                  // Paste before cursor position
        }
    },
    
    // Command sequence: single key bound to multiple ModalEx commands, executed in sequence
    "o": [
        "editor.action.insertLineAfter",     // Press o key to insert new line below cursor's current line
        "modalex.enterInsert"                // Enter Insert mode
    ],
    
    // Nested key mapping: use of combination keys
    "d": {
        "d": "modalex.action.deleteAndYankLine",    // Press d key then d key to delete current entire line
        "w": "deleteWordRight",                     // Press d key then w key to delete word
        "x": {
            // ...                                  // Similarly, can continue nesting
        }
    },
    
    // Mode switching commands
    "i": "modalex.enterInsert",               // Press i key to enter Insert mode
    "a": "modalex.enterInsertRight",          // Press a key to enter Insert mode and move cursor right
    "v": "modalex.enterVisual",               // Press v key to enter Visual mode
    "V": "modalex.enterVisualLine"            // Press V key to enter Visual Line mode
}
```

**Note**: Commands with parameters and nested key mappings cannot exist at the same time, the following configuration method is invalid:

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

# Preset

## `Simple` Preset Key Configuration

The built-in "simple" preset in ModalEx provides a basic Vim-like key configuration, enabled by default. This preset defines the following main key bindings:

### Normal Mode
* `h` - Move cursor left
* `j` - Move cursor down
* `k` - Move cursor up
* `l` - Move cursor right
* `i` - Enter Insert mode
* `a` - Enter Insert mode and move cursor right by one position
* `v` - Enter Visual mode
* `V` - Enter Visual Line mode
* `x` - Delete character to the right of cursor
* `X` - Delete character to the left of cursor
* `w` - Move to next word beginning
* `W` - Move to next word beginning
* `b` - Move to previous word beginning
* `B` - Move to previous word beginning
* `e` - Move to next word end
* `E` - Move to next word end
* `o` - Create a new line below current line and enter Insert mode
* `O` - Create a new line above current line and enter Insert mode
* `dd` - Delete current line and copy to clipboard
* `yy` - Copy current line to clipboard
* `p` - Paste clipboard content after cursor, if the pasted content is a line of text (i.e., copied with `yy`), paste it to the next line of the cursor's current line
* `P` - Paste clipboard content before cursor, if the pasted content is a line of text (i.e., copied with `yy`), paste it to the previous line of the cursor's current line
* `db` - Delete previous word
* `de` - Delete to word end
* `dw` - Delete next word
* `f` - Search forward for a single character
* `F` - Search backward for a single character
* `/` - Search forward for text
* `?` - Search backward for text
* `n` - Jump to next search result
* `N` - Jump to previous search result
* `u` - Undo operation

### Visual Mode
* `h` - Extend selection area to the left
* `j` - Extend selection area downward
* `k` - Extend selection area upward
* `l` - Extend selection area to the right
* `w` - Extend selection area by word to the right
* `e` - Extend to word end
* `b` - Extend selection area by word to the left
* `I` - Enter Insert mode at the beginning of selected area
* `A` - Enter Insert mode at the end of selected area
* `y` - Copy selected content and return to Normal mode
* `Y` - Copy selected content and return to Normal mode
* `d` - Cut selected content and return to Normal mode
* `x` - Cut selected content and return to Normal mode
* `p` - Paste clipboard content and return to Normal mode
* `s` - Cut selected content and enter Insert mode
* `f` - Search forward for a single character
* `F` - Search backward for a single character

### Insert Mode
Insert mode keys in the Simple preset are empty, users can set keys to return to Normal mode through custom configuration.



# Mode Description

## Search Mode

Search mode does not support custom key bindings. After entering this mode, the system will record all input characters, execute search when Enter key is pressed, and position the cursor at the matching location.

Search mode adopts different search strategies based on parameters when entering, supporting the following parameters:

* **searchRange**: Search scope.
  * **line**: Search only within the line where the cursor is located
  * **document**: Search within the entire document

* **searchDirection**: Search direction.
  * **before**: Search from cursor position toward the beginning of file or beginning of line
  * **after**: Search from cursor position toward the end of file or end of line
  * **start**: Search from beginning of line or document toward the end
  * **reverse**: Search from end of line or document toward the beginning

* **singleChar**: If true, only search for a single character, immediately jump to target position after pressing a character, no need to press Enter key.


# Commands

ModalEx provides two types of functionality: control commands and editing commands.

## VSCode Command Palette

Source code see [`/src/commands/base.ts`](src/commands/base.ts)

* **Enable ModalEx**: Enable modal editing functionality
* **Disable ModalEx**: Disable modal editing functionality
* **ModalEx reload config**: Reload extension configuration. When customKeymaps file content changes, this command can be used to reload. VSCode settings will automatically reload when changes occur, no need to use this command
* **ModalEx edit custom keymaps**: Open custom key mapping file for modification

## Control Commands (can be used for key bindings)

Source code see [`/src/commands/base.ts`](src/commands/base.ts)

* **modalex.enable**: Enable modal editing functionality
* **modalex.disable**: Disable modal editing functionality
* **modalex.reload**: Reload extension configuration. When customKeymaps file content changes, this command can be used to reload. VSCode settings will automatically reload when changes occur, no need to use this command
* **modalex.editCustomKeymaps**: Open custom key mapping file for modification
* **modalex.enterNormal**: Enter Normal mode
* **modalex.enterInsert**: Enter Insert mode, supports the following parameters:
  * **right** (optional): If true, when entering insert mode, move cursor right by one position, similar to Vim's "a" key functionality
* **modalex.enterInsertRight**: Enter Insert mode and move cursor right by one position, equivalent to `modalex.enterInsert` parameter as `{right: true}`
* **modalex.enterVisual**: Enter Visual mode
* **modalex.enterVisualLine**: Enter Visual mode, but select by line
* **modalex.enterVisualBlock**: Enter Visual mode, but create a cursor on each line
* **modalex.enterSearchCharLineBefore**: Enter Search mode, used to search forward for a single character on the current line cursor position. After pressing a character, immediately jump to that character position, no need to press Enter key
* **modalex.enterSearchCharLineAfter**: Enter Search mode, used to search backward for a single character on the current line cursor position. After pressing a character, immediately jump to that character position, no need to press Enter key
* **modalex.enterSearchBefore**: Enter Search mode, used to search forward for text in the entire document from cursor position. Need to input complete search term and press Enter key to execute search
* **modalex.enterSearchAfter**: Enter Search mode, used to search backward for text in the entire document from cursor position. Need to input complete search term and press Enter key to execute search
* **modalex.searchNext**: Can be used in any mode, jump to next match position
* **modalex.searchPrev**: Can be used in any mode, jump to previous match position

## Editing Commands (can be used for key bindings)

These commands provide practical editing functions, source code see [`/src/commands/actions.ts`](src/commands/actions.ts)

* **modalex.action.yank**: Copy selected text to clipboard
* **modalex.action.cut**: Cut selected text to clipboard
* **modalex.action.yankLine**: Copy current line to clipboard, including line ending newline
* **modalex.action.cutLine**: Cut current line to clipboard, including line ending newline
* **modalex.action.paste**: Paste clipboard content at cursor position. Supports the following parameters:
  * **before** (optional): If true, paste before cursor position; otherwise paste after cursor position
  * **enterNormal** (optional): If true, automatically enter Normal mode after pasting
* **modalex.action.transformToUppercase**: Convert character at cursor position or characters in selected area to uppercase
* **modalex.action.transformToLowercase**: Convert character at cursor position or characters in selected area to lowercase
* **modalex.action.cursorUpSelect**: In Visual mode, move cursor up and extend selection area
* **modalex.action.cursorDownSelect**: In Visual mode, move cursor down and extend selection area
* **modalex.action.cursorLeftSelect**: In Visual mode, move cursor left and extend selection area
* **modalex.action.cursorRightSelect**: In Visual mode, move cursor right and extend selection area

# License

MIT License
