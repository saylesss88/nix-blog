+++
title = "Nix Repl"
date = 2025-05-06
+++

**TOC**

# Nix Repl List available commands

<!--toc:start-->

- [Nix Repl List available commands](#nix-repl-list-available-commands)
  - [Load Nix expressions Directly](#load-nix-expressions-directly) - [Load Flakes](#load-flakes) - [Debugging with a Flake REPL output](#debugging-with-a-flake-repl-output) - [Usage](#usage) - [Debugging](#debugging)
  <!--toc:end-->

List available commands with `:?`:

```nix
nix repl
Nix 2.24.11
Type :? for help.
nix-repl> :?
The following commands are available:

  <expr>                       Evaluate and print expression
  <x> = <expr>                 Bind expression to variable
  :a, :add <expr>              Add attributes from resulting set to scope
  :b <expr>                    Build a derivation
  :bl <expr>                   Build a derivation, creating GC roots in the
                               working directory
  :e, :edit <expr>             Open package or function in $EDITOR
  :i <expr>                    Build derivation, then install result into
                               current profile
  :l, :load <path>             Load Nix expression and add it to scope
  :lf, :load-flake <ref>       Load Nix flake and add it to scope
  :p, :print <expr>            Evaluate and print expression recursively
                               Strings are printed directly, without escaping.
  :q, :quit                    Exit nix-repl
  :r, :reload                  Reload all files
  :sh <expr>                   Build dependencies of derivation, then start
                               nix-shell
  :t <expr>                    Describe result of evaluation
  :u <expr>                    Build derivation, then start nix-shell
  :doc <expr>                  Show documentation of a builtin function
  :log <expr>                  Show logs for a derivation
  :te, :trace-enable [bool]    Enable, disable or toggle showing traces for
                               errors
  :?, :help                    Brings up this help menu
```

## Load Nix expressions Directly

You can quickly evaluate a random Nix expression:

```nix
nix repl --expr '{a = { b = 3; c = 4; }; }'

Welcome to Nix 2.11.0. Type :? for help.

Loading installable ''...
Added 1 variables.
nix-repl> a
{ b = 3; c = 4; }
```

- The `--expr` flag is helpful to prime directly the Nix REPL with valuable data
  or values.

### Load Flakes

We can use the `--expr` flag to load a random Nix Flake directly:

```nix
nix repl --expr 'builtins.getFlake "github:nix-community/ethereum.nix"'
```

Also, you can load a flake directly inside the REPL with `:load-flake` or `:lf`:

```nix
nix repl

nix-repl> :lf github:nix-community/home-manager
# or
nix-repl> :lf /path/to/your/flake
```

#### Debugging with a Flake REPL output

- One way to do this is to launch the repl with `nix repl` and inside the repl type `:lf /path/to/flake`. Or `nixos-rebuild repl --flake /path/to/flake` the latter provides a helpful welcome script showing what is loaded into your repl's scope.

I like to create a simple repl output to load your flake into the environment with `nix repl .#repl`.

First, we'll create a REPL environment to inspect and debug our flake's outputs,packages, and configurations. Define a `repl` output in `flake.nix` for easy access with `nix repl .#repl`:

```nix
# flake.nix
outputs = { self, nixpkgs, ... }: let
  pkgs = import nixpkgs { system = "x86_64-linux"; };
in {
  repl = import ./repl.nix {
    inherit (pkgs) lib;
    flake = self;
    pkgs = pkgs;
  };
};
```

And in `repl.nix`:

```nix
# repl.nix
{
  lib,
  flake,
  pkgs,
}: {
  inherit flake pkgs lib;
  configs = flake.nixosConfigurations;
  # inherit (flake.outputs) userVars;
}
# Accepts `lib`, `flake`, `pkgs` from `flake.nix` as arguments
# Attributes: flake: all flake outputs (flake.outputs, flake.inputs)
# run `nix repl .#repl` to load the REPL environment
# :l <nixpkgs>  # load additional Nixpkgs if needed
# :p flake.inputs.nixpkgs.rev # nixpkgs revision
# :p flake.inputs.home-manager.rev
# flake.outputs.packages.x86_64-linux.default # inspect default package
# pkgs.helix # access helix package
# lib.version # check lib version
# configs.magic.config.environment.systemPackages # list packages
# configs.magic.config.home-manager.users.jr.home.packages # home packages
# :p configs.magic.config.home-manager.users.jr.programs.git.userName
# Debugging
# :p builtins.typeOf configs.magic (should be `set`)
# :p builtins.attrNames configs.magic
# :p configs.magic.config # errors indicate issues
# :p configs.magic.config.environment # isolate the module or issue
# :p builtins.attrNames configs.magic.config.home-manager.users.jr # home attrs
# :p configs.magic.config.home-manager.users.jr.programs.git.enable # true/false
#  :p lib.filterAttrs (n: v: lib.hasPrefix "firefox" n) pkgs
# :p configs.magic.config.stylix # check theming
# :p configs.magic.config.home-manager.users.jr.stylix
# :p lib.mapAttrsToList (name: cfg: name) configs
```

> ❗: Replace `magic` with your host name

##### Usage

Load REPL environment with:
`nix repl .#repl`

Attributes:

```nix
nix-repl> builtins.attrNames flake.inputs
[
  "dont-track-me"
  "helix"
  "home-manager"
  "hyprland"
  "neovim-nightly-overlay"
  "nixpkgs"
  "nvf"
  "rose-pine-hyprcursor"
  "stylix"
  "treefmt-nix"
  "wallpapers"
  "wezterm"
  "yazi"
]
nix-repl> builtins.attrNames flake.outputs
[
  "checks"
  "devShells"
  "formatter"
  "nixosConfigurations"
  "packages"
  "repl"
]
nix-repl> flake.outputs.formatter
{
  x86_64-linux = «derivation /nix/store/q71q00wmh1gnjzdrw5nrvwbr6k414036-treefmt.drv»;
}
```

- Inspect the default package output:

```nix
nix-repl> flake.outputs.packages.x86_64-linux.default
«derivation /nix/store/6kp660mm62saryskpa1f2p6zwfalcx2w-default-tools.drv»
```

- From here out I'll leave out the `nix-repl>` prefix just know that it's there.

- Check lib version(Nixpkgs `lib` attribute):

```nix
lib.version
"25.05pre-git"
```

- List systemPackages and home.packages, my hostname is `magic` list yours in its place:

```nix
configs.magic.config.environment.systemPackages
# list home.packages
configs.magic.config.home-manager.users.jr.home.packages
```

- Or an individual value:

```nix
:p configs.magic.config.home-manager.users.jr.programs.git.userName
TSawyer87
```

##### Debugging

- Check if the module system is fully evaluating, anything other than a "set" the configuration isn't fully evaluated (e.g. "lambda" might indicate an unevaluated thunk):

```nix
:p builtins.typeOf configs.magic
set
```

- Debugging Module System:

- Check if `configs.magic` is a valid configuration:

```nix
:p builtins.attrNames configs.magic
```
