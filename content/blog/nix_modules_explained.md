+++
title = "NixOS Modules Explained"
date = 2025-05-09
author = "T Sawyer"
+++

# NixOS Modules

**TOC**

<!--toc:start-->

- [NixOS Modules](#nixos-modules)
  - [Declaring Options](#declaring-options)
    - [Module Composition](#module-composition)
    - [NixOS Modules and Dependency Locking with npins](#nixos-modules-and-dependency-locking-with-npins)
    - [Resources on Modules](#resources-on-modules)
- [Videos](#videos)
- [[tweagModuleSystemRecursion](https://www.youtube.com/watch?v=cZjOzOHb2ow)](#tweagmodulesystemrecursionhttpswwwyoutubecomwatchvczjozohb2ow)
<!--toc:end-->

<img src="/images/gruv3.png" alt="Cyber" width="700">

TL;DR: In this post I break down the NixOS module system and explain how to
define options. As well as how to test modules with the repl.

- Most modules are functions that take an attribute set and return an attribute
  set.

**Refresher**:

- An **attribute set** is a collection of name-value pairs wrapped in curly
  braces:

```nix
{
  string = "hello";
  int = 3;
}
```

- A **function** with an attribute set argument:

```nix
{ a, b }: a + b
```

- The simplest possible **NixOS Module**:

```nix
{ ... }:
{
}
```

NixOS produces a full system configuration by combining smaller, more isolated
and reusable components: **Modules**. In my opinion modules are one of the
first things you should understand when learning about NixOS.

- A NixOS module defines configuration options and behaviors for system
  components, allowing users to extend, customize, and compose configurations
  declaratively.

- A **module** is a file containing a Nix expression with a specific structure.
  It _declares_ options for other modules to define (give a value). Modules were
  introduced to allow extending NixOS without modifying its source code.

- To define any values, the module system first has to know which ones are
  allowed. This is done by declaring options that specify which attributes can
  be set and used elsewhere.

- If you want to write your own modules, I recommend setting up
  [nixd](https://github.com/nix-community/nixd?tab=readme-ov-file)
  or [nil](https://github.com/oxalica/nil) with your editor of choice.
  This will allow your editor to warn you about missing arguments and
  dependencies as well as syntax errors.

## Declaring Options

The following is `nixpkgs/nixos/modules/programs/vim.nix`:

```nix
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.programs.vim;
in
{
  options.programs.vim = {
    enable = lib.mkEnableOption "Vi IMproved, an advanced text";

    defaultEditor = lib.mkEnableOption "vim as the default editor";

    package = lib.mkPackageOption pkgs "vim" { example = "vim-full"; };
  };

  # TODO: convert it into assert after 24.11 release
  config = lib.mkIf (cfg.enable || cfg.defaultEditor) {
    warnings = lib.mkIf (cfg.defaultEditor && !cfg.enable) [
      "programs.vim.defaultEditor will only work if programs.vim.enable is enabled, which will be enforced after the 24.11 release"
    ];
    environment = {
      systemPackages = [ cfg.package ];
      variables.EDITOR = lib.mkIf cfg.defaultEditor (lib.mkOverride 900 "vim");
      pathsToLink = [ "/share/vim-plugins" ];
    };
  };
}
```

- It provides options to enable Vim, set it as the default editor, and specify
  the Vim package to use.

1. Module Inputs and Structure:

```nix
{
  config,
  lib,
  pkgs,
  ...
}
```

- Inputs: The module takes the above inputs and `...` (catch-all for other args)

  - `config`: Allows the module to read option values (e.g.
    `config.programs.vim.enable`). It provides access to the evaluated
    configuration.

  - `lib`: The Nixpkgs library, giving us helper functions like `mkEnableOption`
    , `mkIf`, and `mkOverride`.

  - `pkgs`: The Nixpkgs package set, used to access packages like `pkgs.vim`

  - `...`: Allows the module to accept additional arguments, making it flexible
    for extension in the future.

> Key Takeaways: A NixOS module is typically a function that can include
> `config`, `lib`, and `pkgs`, but it doesn’t require them. The `...`
> argument ensures flexibility, allowing a module to accept extra inputs
> without breaking future compatibility. Using `lib` simplifies handling
> options (mkEnableOption, mkIf, mkOverride) and helps follow best practices.
> Modules define options, which users can set in their configuration, and
> `config`, which applies changes based on those options.

2. Local Configuration Reference:

```nix
let
  cfg = config.programs.vim;
in
```

- This is a local alias. Instead of typing `config.programs.vim` over and over,
  the module uses `cfg`.

3. Option Declaration

```nix
options.programs.vim = {
  enable = lib.mkEnableOption "Vi IMproved, an advanced text";
  defaultEditor = lib.mkEnableOption "vim as the default editor";
  package = lib.mkPackageOption pkgs "vim" { example = "vim-full"; };
};
```

This defines three user-configurable options:

- `enable`: Turns on Vim support system-wide.

- `defaultEditor`: Sets Vim as the system's default `$EDITOR`.

- `package`: lets the user override which Vim package is used.

> `mkPackageOption` is a helper that defines a package-typed option with a
> default (`pkgs.vim`) and provides docs + example.

4. Conditional Configuration

```nix
config = lib.mkIf (cfg.enable || cfg.defaultEditor) {
```

- This block is only activated if _either_ `programs.vim.enable` or
  `defaultEditor` is set.

5. Warnings

```nix
warnings = lib.mkIf (cfg.defaultEditor && !cfg.enable) [
  "programs.vim.defaultEditor will only work if programs.vim.enable is enabled, which will be enforced after the 24.11 release"
];
```

- Gives you a soft warning if you try to set `defaultEditor = true` without
  also enabling Vim.

6. Actual System Config Changes

```nix
environment = {
  systemPackages = [ cfg.package ];
  variables.EDITOR = lib.mkIf cfg.defaultEditor (lib.mkOverride 900 "vim");
  pathsToLink = [ "/share/vim-plugins" ];
};
```

- It adds Vim to your `systemPackages`, sets `$EDITOR` if `defaultEditor` is
  true, and makes `/share/vim-plugins` available in the environment.

The following is a bat home-manager module that I wrote:

```nix
# bat.nix
{
  pkgs,
  config,
  lib,
  ...
}: let
  cfg = config.custom.batModule;
in {
  options.custom.batModule.enable = lib.mkOption {
    type = lib.types.bool;
    default = false;
    description = "Enable bat module";
  };

  config = lib.mkIf cfg.enable {
    programs.bat = {
      enable = true;
      themes = {
        dracula = {
          src = pkgs.fetchFromGitHub {
            owner = "dracula";
            repo = "sublime"; # Bat uses sublime syntax for its themes
            rev = "26c57ec282abcaa76e57e055f38432bd827ac34e";
            sha256 = "019hfl4zbn4vm4154hh3bwk6hm7bdxbr1hdww83nabxwjn99ndhv";
          };
          file = "Dracula.tmTheme";
        };
      };
      extraPackages = with pkgs.bat-extras; [
        batdiff
        batman
        prettybat
        batgrep
      ];
    };
  };
}
```

Now I could add this to my `home.nix` to enable it:

```nix
# home.nix
custom = {
  batModule.enable = true;
}
```

- If I set this option to true the bat configuration is dropped in place. If
  it's not set to true, it won't put the bat configuration in the system. Same
  as with options defined in modules within the Nixpkgs repository.

- If I had set the default to `true`, it would automatically enable the module
  without requiring an explicit `custom.batModule.enable = true;` call in my
  `home.nix`.

### Module Composition

- NixOS achieves its full system configuration by combining the configurations
  defined in various modules. This composition is primarily handled through the
  `imports` mechanism.

- `imports`: This is a standard option within a NixOS or Home Manager
  configuration (often found in your configuration.nix or home.nix). It takes
  a list of paths to other Nix modules. When you include a module in the imports
  list, the options and configurations defined in that module become part of
  your overall system configuration.

- You declaratively state the desired state of your system by setting options
  across various modules. The NixOS build system then evaluates and merges these
  option settings. The culmination of this process, which includes building the
  entire system closure, is represented by the derivation built by
  `config.system.build.toplevel`.

### NixOS Modules and Dependency Locking with npins

This is the file structure:

```bash
❯ tree
.
├── configuration.nix
├── default.nix
├── desktop.nix
└── npins
    ├── default.nix
    └── sources.json
```

This uses `npins` for dependency locking. Install it and run this in the project

directory:

```bash
npins init
```

Create a `default.nix` with the following:

```nix
# default.nix
{ system ? builtins.currentSystem, sources ? import ./npins, }:
let
  pkgs = import sources.nixpkgs {
    config = { };
    overlays = [ ];
  };
  inherit (pkgs) lib;
in lib.makeScope pkgs.newScope (self: {

  shell = pkgs.mkShell { packages = [ pkgs.npins self.myPackage ]; };

    # inherit lib;

  nixosSystem = import (sources.nixpkgs + "/nixos") {
    configuration = ./configuration.nix;
  };

  moduleEvale = lib.evalModules {
    modules = [
      # ...
    ];
  };
})
```

A `configuration.nix` with the following:

```nix
# configuration.nix
{
  boot.loader.grub.device = "nodev";
  fileSystems."/".device = "/devst";
  system.stateVersion = "25.05";

  # declaring options means to declare a new option
  # defining options means to define a value of an option
  imports = [
    # ./main.nix
     ./desktop.nix # Files
    # ./minimal.nix
  ];

  # mine.desktop.enable = true;
}
```

And a `desktop.nix` with the following:

```nix
# desktop.nix
{ pkgs, lib, config, ... }:

{
  imports = [];

  # Define an option to enable or disable desktop configuration
  options.mine.desktop.enable = lib.mkEnableOption "desktop settings";

  # Configuration that applies when the option is enabled
  config = lib.mkIf config.mine.desktop.enable {
    environment.systemPackages = [ pkgs.git ];
  };
}
```

`mkEnableOption` defaults to false. Now in your `configuration.nix` you can
uncomment `mine.desktop.enable = true;` to enable the desktop config and
vice-versa.

You can test that this works by running:

```bash
nix-instantiate -A nixosSystem.system
```

- `nix-instantiate` performs only the evaluation phase of Nix expressions.
  During this phase, Nix interprets the Nix code, resolves all dependencies, and
  constructs derivations but does not execute any build actions. Useful for
  testing.

To check if this worked and `git` is installed in systemPackages you can
load it into `nix repl` but first you'll want `lib` to be available so uncomment
this in your `default.nix`:

```nix
# default.nix
inherit lib;
```

Rerun `nix-instantiate -A nixosSystem.system`

Then load the repl and check that `git` is in `systemPackages`:

```bash
nix repl -f .
nix-repl> builtins.filter (pkg: lib.hasPrefix "git" pkg.name) nixosSystem.config.environment.systemPackages
```

This shows the path to the derivation

Check that mine.desktop.enable is true

```nix
nix-repl> nixosSystem.config.mine.desktop.enable
true
```

### Resources on Modules

- [WritingNixOsModules](https://nixos.org/manual/nixos/stable/#sec-writing-modules)

- [NixWikiNixOSModules](https://nixos.wiki/wiki/NixOS_modules)

- [nix.dev A basic module](https://nix.dev/tutorials/module-system/a-basic-module/index.html)

- [ModuleSystemDeepDive](https://nix.dev/tutorials/module-system/deep-dive#module-system-deep-dive)

- [MakingNixOSModulesForFun](https://xeiaso.net/talks/asg-2023-nixos/)

- [xeiaso Nixos Modules for fun & profit](https://xeiaso.net/talks/asg-2023-nixos/)

- [NixOS Flakes Book Module System](https://nixos-and-flakes.thiscute.world/other-usage-of-flakes/module-system)

# Videos

[NixHour Writing NixOS modules](https://www.youtube.com/watch?v=N7hFP_40DJo&t=17s) -- This example is from this video
[infinisilModules](https://infinisil.com/modules.mp4)

# [tweagModuleSystemRecursion](https://www.youtube.com/watch?v=cZjOzOHb2ow)
