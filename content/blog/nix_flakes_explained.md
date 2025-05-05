+++
title = "Nix Flakes Explained"
date = 2025-05-05
+++

### Nix Flakes For NixOS Configuration Explained

- This is more intended to highlight some common gotchas and places of confusion for beginners than to be a complete guide.

- You can think of the `flake.nix` as an entry point and a way of acquiring dependencies (`inputs`) that are required for evaluation.

- A flake is simply a source tree (e.g. git repo) containing a `flake.nix` that provides a standardized interface to Nix artifacts (e.g. packages, modules)

- Attribute sets are all over Nix Code, they are simply name value pairs wrapped in curly braces:

```nix
let
  my_attrset = { foo = "bar"; };
in my_attrset.foo
```

Output: `"bar"`

- Note: `{}` is a valid attribute set in Nix.

- Flakes have what are called top-level attributes (i.e. you can access them without using dot notation). Some top-level attributes are `inputs`, `outputs`, and `nixConfig`.

- Flake commands are space separation for subcommands like this: `nix build`, the older cli commands are written with a hyphen `nix-build`.

Basic Flake Structure:

```nix
{
  description = package description
  inputs = dependencies
  outputs = what the flake produces
  nixConfig = advanced configuration options
}
```

- The `flake.nix` file must contain an attribute set with one required attribute - `outputs` - and optionally `description` and `inputs`.

#### Inputs

- You can think of `inputs` as the dependencies this flake relies on.

- `inputs`: An attribute set specifying the dependencies of the flake where the keys are the names of your flakes dependencies, and the values are references to those other flakes. To access something from a dependency, you would typically go through `inputs` (i.e. `inputs.helix.packages`)

The following specifies a dependency on the `nixpkgs` and `import-cargo` repositories:

```nix
inputs = {
  import-cargo.url = "github:edolstra/import-cargo";
  nixpkgs.url = "nixpkgs";
}
```

- Each input is fetched, evaluated and passed to the `outputs` function as a set of attributes with the same name as the corresponding input.

  - The special input `self` refers to the outputs and source tree of _this flake_.

  - Each input is fetched, evaluated and passed to the `outputs` function as a set of attributes with the same name as the corresponding input.

#### Outputs

- You can think of outputs as the things your flake provides (i.e. Your configuration, packages, devShells, derivations)

- Flakes can provide arbitrary Nix values, such as packages, NixOS modules or library functions. These are called _outputs_. Some outputs have special meaning to certain Nix commands and therefore must be a specific type. If you look at the [output schema](https://nixos.wiki/wiki/Flakes) you'll see that most expect a derivation

Show your flakes outputs with:

```nix
nix flake show
```

This command actually takes a flake URI and prints all the outputs of the flake as a nice tree structure, mapping attribute paths to the types of values.

- Beginners might initially think that `self` and `nixpkgs` within the `outputs = { self, nixpkgs, ... }` definition are the 'outputs' themselves. However, these are actually the _input arguments_ (which are often called _output arguments_) to the `outputs` function. This distinction is key to grasping the outputs of a flake.

- Remember that the `outputs` function itself takes a single argument, which is an attribute set. Even though it looks like multiple arguments `{ self, nixpkgs, ... }`, this syntax in Nix is destructuring that single input attribute set to extract its individual fields.

- `self` is a way to reference "this" flake. You could use `self.inputs` to access the `inputs` top-level attribute. The `outputs` function always receives an argument conventionally named `self`. This argument is a reference to the flake itself including all of it's top-level attributes. You typically use `self` to refer to things within your own flake. (i.e. `self.packages.my-package`)

> [!NOTE]: The `...` syntax is for variadic attributes, (i.e. a varying number of attributes). If you notice most flakes have many more inputs than are explicitly listed in the _input arguments_ this is possible because of variadic attributes.

In the following example `c = 2` is an extra attribute:

```nix
mul = { a, b, ... }: a*b
mul { a = 3; b = 4; c = 2; }
```

However, in the function body you cannot access the "c" attribute. The solution is to give a name to the given set with the @-pattern:

```nix
nix-repl> mul = s@{ a, b, ... }: a*b*s.c  # s.c = 2
nix-repl> mul { a = 3; b = 4; c = 2; }
24
```

- `@-patterns` in the `outputs` function argument list provides a convenient way to bind the entire attribute set to a name (i.e. `outputs = { pkgs, ... } @ inputs`).

- When you write `outputs = { pkgs, ... } @ inputs`, it does the following:

  - Destructures the input attribute set: It tries to extract the value associated with the key `pkgs` from the input attribute set and bind it to the variable `pkgs`. The `...` allows for other keys in the input attr set to be ignored in this direct destructuring.

  - Binds the entire attribute set to `inputs`

```nix
{
  inputs.nixpkgs.url = github:NixOS/nixpkgs/nixos-unstable;
  inputs.home-manager.url = github:nix-community/home-manager;

  # outputs is a function that takes an attribute set that returns an
  # attribute set (e.g. outputs multiple values)
  outputs = { self, nixpkgs, ... }@attrs: {

    # a `packages` output
    packages.x86_64-linux.hello = nixpkgs.legacyPackages.x86_64-linux.hello;

    # Below is the nixosConfigurations output (e.g. your NixOs configuration)
    nixosConfigurations.fnord = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      specialArgs = attrs;
      modules = [ ./configuration.nix ];
    };
  };
}
```

- Flakes promise that the outputs of a flake should be the same regardless of the evaluator's environment. Because of this, all flake outputs that have anything to do with packages must specify the platform explicitly in some way.

  - Platform is a combination of architecture and OS. (e.g. `x86_64-linux`).

  - `legacyPackages` is designed specifically for nixpkgs. It makes it possible to work with `nixpkgs` arbitrary attribute format from older packages. What this means is that `nixpkgs` traditionally organizes packages directly under the top level (e.g. `pkgs.hello`), and `legacyPackages` provides a consistent platform-aware way to access these within the flake's structured output format.

  - To expand further, Flakes enforce a more structured way of organizing outputs. For package outputs, the expected schema typically has the platform specification as a top-level attribute (i.e. `packages.x86_64-linux.my-package`). This ensures that when you ask a flake for a package, it's clear which platform the package is intended for. It's kind of like an API for flakes and legacy packages to be able to work together.

- Flakes take a sole argument which is another point of confusion, how is it a sole argument if im passing `{ self, nixpkgs, ... }`? This syntax is actually shorthand for a single argument that is an attribute set.

  - Remember, a valid attribute set in nix is `{}`. `{ a = 1; }` is an attribute set with a single value. An attribute set is simply a set of name value pairs wrapped in curly braces.(e.g. `{self, nixpkgs, ... }`). Notice also that in the _inputs arguments_ commas are used and everywhere else uses semicolon `;`

- Outputs (of the Flake): Refers to the attribute set that is returned by the `outputs` function.

- To recap the `outputs` function takes an attribute set as its argument and returns an attribute set.

- I already covered that `nixosConfigurations` outputs your NixOS configuration, there can be many other types of outputs explained below.

### Imports

- You can think of `import` as "evaluate the Nix expression in this file" and return its value.

- The `import` function in Nix takes a path (usually a string representating a file or directory i.e. `./lib/dev-shell.nix`) and evaluates the Nix expression found at that location.

- One point of confusion is the following:

```nix
{
  outputs = { self, nixpkgs, ... }: {
    nixosConfigurations.my-system = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./modules/base.nix
        (import ./modules/desktop.nix { pkgs = nixpkgs; })
      ];
    };
  };
}
```

- With `(import ./modules/desktop.nix { pkgs = nixpkgs; })` you're actually saying import the file at this location but also export `nixpkgs` to said file to make it available.

When you see:

```nix
let
  myHelpers = import ./lib/my-helpers.nix { pkgs = nixpkgs; };
in
```

You are:

1. Importing the Nix expression from `./lib/my-helpers.nix`

2. Passing an attribute set `{ pkgs = nixpkgs; }` as an argument to the evaluated expression in the imported file.

Inside `lib/my-helpers.nix`, there will likely be a function definiton that expects an argument (often also named `pkgs` by convention):

```nix
# ./lib/my-helpers.nix
{ pkgs }:
let
  myPackage = pkgs.stdenv.mkDerivation {
    name = "my-package";
    # ...
  };
in
myPackage
```

- By passing `{ pkgs = nixpkgs; }` during the import, you are essentially saying: The `pkgs` that the code in `./lib/my-helpers.nix` expects as an argument should be the `nixpkgs` that is available within the scope of my current `flake.nix`(the `nixpkgs` passed as an argument to the `outputs` function)

- When you use import with a path that points to a directory, Nix doesn't just try to import the directory itself (which wouldn't make sense as a Nix value). Instead, it automatically looks for a file named `default.nix` within that directory.

- If a `default.nix` file is found inside the specified directory, Nix will then evaluate the Nix expressions within that `default.nix` file, just as if you had directly specified the path to `default.nix` in your import statement. The result of evaluating `default.nix` becomes the value returned by the import function.

#### Resources

- [practical-nix-flakes](https://serokell.io/blog/practical-nix-flakes)

- [tweag nix-flakes](https://www.tweag.io/blog/2020-07-31-nixos-flakes/)

- [NixOS-wiki Flakes](https://nixos.wiki/wiki/Flakes)

- [nix.dev flakes](https://nix.dev/concepts/flakes.html)

- [flakes-arent-real](https://jade.fyi/blog/flakes-arent-real/)

- [wombats-book-of-nix](https://mhwombat.codeberg.page/nix-book/#_attribute_set_operations)

- [zero-to-nix flakes](https://zero-to-nix.com/concepts/flakes/)

- [nixos-and-flakes-book](https://nixos-and-flakes.thiscute.world/)
