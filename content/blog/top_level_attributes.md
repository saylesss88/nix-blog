+++
title = "Top-Level Attributes"
date = 2025-05-07
+++

## Top-Level Attributes

The following is a comment by Infinisil (Nix legend) on Reddit:

A NixOS system is described by a single system derivation. nixos-rebuild builds this derivation with

```nix
$ nix-build '<nixpkgs/nixos>' -A system
```

and then switches to that system with

```nix
$ result/bin/switch-to-configuration
```

The entrypoint is the file at `'<nixpkgs/nixos>'` (`./default.nix`), which defines the system attribute to be the NixOS option `system.build.toplevel`. This toplevel option is the topmost level of the NixOS evaluation and it's what almost all options eventually end up influencing through potentially a number of intermediate options.

As an example:

- The high-level option `services.nginx.enable` uses the lower-level option `systemd.services.nginx`

- Which in turn uses the even-lower-level option `systemd.units."nginx.service"`

- Which in turn uses `environment.etc."systemd/system"`

- Which then ends up as `result/etc/systemd/system/nginx.service` in the top-level derivation

So high-level options use lower-level ones, eventually ending up at `system.build.toplevel`.

How do these options get evaluated though? That's what the NixOS module system does, which lives in the ./lib directory (in modules.nix, options.nix and types.nix). The module system can even be used without NixOS, allowing you to use it for your own option sets. Here's a simple example of this, whose toplevel option you can evaluate with:

```bash
nix-instantiate --eval file.nix -A config.toplevel
```

```nix
let
  systemModule = { lib, config, ... }: {
    options.toplevel = lib.mkOption {
      type = lib.types.str;
    };

    options.enableFoo = lib.mkOption {
      type = lib.types.bool;
      default = false;
    };

    config.toplevel = ''
      Is foo enabled? ${lib.boolToString config.enableFoo}
    '';
  };

  userModule = {
    enableFoo = true;
  };

in (import <nixpkgs/lib>).evalModules {
  modules = [ systemModule userModule ];
}
```

The module system itself is rather complex, but here's a short overview. A module evaluation consists of a set of "modules", which can do three things:

- Import other modules (through `imports = [ ./other-module.nix ];`)

- Declare options (through `options = { ... };`)

- Define option values (through `config = { ... };`, or without the config key as a shorthand if you don't have imports or options)

To do the actual evaluation, there's these rough steps:

- Recursively collect all modules by looking at all imports statements

- Collect all option declarations (with options) of all modules and merge them together if necessary

- For each option, evaluate it by collecting all its definitions (with config) from all modules and merging them together according to the options type.

Note that the last step is lazy (only the options you need are evaluated) and depends on other options itself (all the ones that influence it).

This is the end of Infinisil's comment.

`system.build.toplevel` The top-level option that builds the entire NixOS system. Everything else in your configuration is indirectly pulled in by this option. This is what nixos-rebuild builds and what /run/current-system points to afterwards.

Top-level attributes are those defined directly inside the module's function, they include:

- Imports
- Options
- Config

In any module that you define a top-level option any non-option attributes need to be moved under the config attribute.

For example:

```nix
{ pkgs, lib, config, ... }:
{
  imports = [];

# defining this option at top level
options.mine.desktop.enable = lib.mkEnableOption "desktop settings";

# will cause this to fail
environment.systemPackages =
  lib.mkIf config.appstream.enable [ pkgs.git ];

appstream.enable = true;
}
```

error: Module has an unsupported attribute 'appstream' This is caused by introducing a top-level `config` or `options` attribute. Add configuration attributes immediately on the top level instead, or move all of them into the explicit `config` attribute.

- The environment.systemPackages and `appstream.enable` don't declare any options, they assign values to the options so they need to be moved under the config attribute like so:

```nix
{ pkgs, lib, config, ... }:
{
  imports = [];

# defining this option at top level
options.mine.desktop.enable = lib.mkEnableOption "desktop settings";

config = {
 environment.systemPackages =
  lib.mkIf config.appstream.enable [ pkgs.git ];

appstream.enable = true;
};
}
```

- This lets Nix know that you're not declaring an option, but rather setting/defining them.

- Otherwise, if you don't have either `config` or `option` you can just have them at the top-level, and it will implicitely put all of them under the config section.

- If you remove the option, the config = { environment.systemPackages will still work.
