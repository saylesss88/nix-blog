+++
title = "Conditional Configuration"
date = 2025-05-06
+++


# Conditional Configuration
**TOC**
<!--toc:start-->
- [Conditional Configuration](#conditional-configuration)
  - [Hyprland Module](#hyprland-module)
  - [Wlogout Module](#wlogout-module)
<!--toc:end-->


With options it's easy to conditionally install something based on if another
program is enabled in your configuration.

## Hyprland Module

For example, if I have an option to enable or disable hyprland like this:

```nix
# hyprland.nix
{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: let
  cfg = config.custom.hyprland;
in {
  options.custom.hyprland = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Enable hyprland module";
    };
  };
   config = lib.mkIf cfg.enable {
    home.packages = with pkgs; [
      # swww
      grim
      slurp
      wl-clipboard-rs
      cliphist
      swappy
      ydotool
      wpaperd
      wofi
      hyprpicker
      pavucontrol
      blueman
      # lxqt.lxqt-policykit
      brightnessctl
      polkit_gnome
      wlr-randr
      wtype
      rose-pine-cursor
      # nwg-look
      # yad
      # gtk-engine-murrine
    ];

# .. snip ..
```

- Since the above module is set to false, it is necessary to add
  `custom.hyprland.enable = true` to my `home.nix` to have Nix add it
  to my configuration. And since `home.packages` is wrapped in
  `config = lib.mkIf cfg.enable` Those packages will only be installed
  if the module is enabled.

- if I used `programs.hyprland.enable` and added
  `home.packages = [ pkgs.waybar ];` without conditionals, waybar would install
  even if hyprland was disabled.

## Wlogout Module

I can then have my default for something like wlogout be to install only if
the `custom.hyprland` module is enabled:

```nix
# wlogout.nix
{
  config,
  lib,
  ...
}: let
  cfg = config.custom.wlogout;
in {
  options.custom.wlogout = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = config.custom.hyprland.enable;
      description = "Enable wlogout module";
    };
  };
    config = lib.mkIf cfg.enable {
    programs.wlogout = {
      enable = true;
    }
    }
# .. snip ..
```

- The default value of `config.custom.wlogout.enable` is set to
  `config.custom.hyprland.enable`. Therefore, if `config.custom.hyprland.enable`
  evaluates to true, the wlogout module will be enabled by default.

The `lib.mkIf cfg.enable` ensures that wlogout’s configuration
(e.g., enabling `programs.wlogout`) is only applied when
`custom.wlogout.enable = true`, which defaults to `custom.hyprland.enable`.
This means wlogout is enabled by default only if Hyprland is enabled, but
I can override this (e.g., `custom.wlogout.enable = true` without Hyprland).
This conditional logic prevents wlogout from being installed unnecessarily
when Hyprland is disabled, unlike a simpler approach like `programs.wlogout.
enable = config.programs.hyprland.enable`, which hardcodes the dependency and
offers less flexibility.
