+++
title = "Nix Language Basics & Nix Constructs"
date = 2025-05-06
author = "T Sawyer"
+++

**TOC**

# The Nix Language

**TOC**

- [The Nix Language](#the-nix-language)
  - [How does Nix work](#how-does-nix-work)
  - [Syntax Basics](#syntax-basics)
    - [Derivations](#derivations)
    - [Evaluating Nix Files](#evaluating-nix-files)
    - [Resources](#resources)

<img src="/images/gruv18.png" alt="window_view" width="700">

Nix as a programming language can be thought of as a kind of "JSON, but with
functions".

All statements are declarative, meaning that there's no sequential flow of
instructions that makes up a Nix package. Instead, functions are called that
assign values to fields in attribute sets, which in turn may get assigned to
other values.

## How does Nix work

Nix is a pure, functional, lazy, declarative, and reproducible programming
language.

| Concept      | Description                                                   |
| ------------ | ------------------------------------------------------------- |
| Pure         | Functions don't cause side effects.                           |
| Functional   | Functions can be passed as arguments and returned as results. |
| Lazy         | Not evaluated until needed to complete a computation.         |
| Declarative  | Describing a system outcome.                                  |
| Reproducible | Operations that are performed twice return same results       |

- In Nix, the process of managing software starts with package definitions. These are files written in the Nix language that describe how a particular piece of software should be built. These package definitions, when processed by Nix, are translated into derivations.

- At its core, a derivation in Nix is a blueprint or a recipe that describes how to build a specific software package or any other kind of file or directory. It's a declarative specification of:

- Inputs: What existing files or other derivations are needed as dependencies.

- Build Steps: The commands that need to be executed to produce the desired output.

- Environment: The specific environment (e.g., build tools, environment variables) required for the build process.

- Outputs: The resulting files or directories that the derivation produces.

Think of a package definition as the initial instructions, and the derivation as the detailed, low-level plan that Nix uses to actually perform the build."

## Syntax Basics

- Dashes are allowed as identifiers:

```nix
nix-repl> a-b
error: undefined variable `a-b' at (string):1:1
nix-repl> a - b
error: undefined variable `a' at (string):1:1
```

- `a-b` is parsed as an identifier, not as subtraction.

- **Strings**: Strings are enclosed in double quotes (`"`) or two single quotes (`''`).

```nix
nix-repl> "stringDaddy"
"stringDaddy"
nix-repl> ''stringMoma''
"stringMoma"
```

**String Interpolation**: Is a language feature where a string, path, or attribute name can contain expressions enclosed in `${ }`. This construct is called _interpolated string_, and the expression inside is an _interpolated expression_.[string interpolation](https://nix.dev/manual/nix/2.24/language/string-interpolation).

Rather than writing:

```nix
"--with-freetype2-library=" + freetype + "/lib"
```

where `freetype` is a derivation, you could instead write:

```nix
"--with-freetype2-library=${freetype}/lib"
```

And the above expression will be translated to the former.

**Interpolated Expression**: An expression that is interpolated must evaluate to one of the following:

- a string

- a path

- an attribute set that has a `__toString` attribute or an `outPath` attribute.

  - `__toString` must be a function that takes an attribute set itself and returns a string.

  - `outPath` must be a string

  - This includes derivations or flake inputs.

A path in an interpolated expression is first copied into the Nix store, and the resulting string is the store path of the newly created store object.

```bash
mkdir foo
```

reference the empty directory in an interpolated expression:

```nix
"${./foo}"
```

Output: `"/nix/store/2hhl2nz5v0khbn06ys82nrk99aa1xxdw-foo"`

- **Attribute sets** are all over Nix code, they are name-value pairs wrapped in curly braces, where the names must be unique:

```nix
{
  string = "hello";
  int = 8;
}
```

- Attribute names usually don't need quotes.

- List elements are separated by white space.

```nix
programs = {
  bat.enable = true;
}
```

- The `bat.enable` is called dot notation. The above command can be written a few ways:

```nix
programs.bat.enable = true; # using dot notation
# or
programs = {  # using nested attribut sets.
  bat = {
    enable = true;
  }
}
```

You will sometimes see attribute sets with `rec` prepended. This allows access to attributes within the set:

```nix
rec {
  one = 1;
  two = one + 1;
  three = two + 1;
}
```

- Without `rec`, this command would fail because we are trying to use an attribute that is defined within this attribute set. You would get an undefined variable 'one' error.

**Inheriting Attributes**

```nix
let x = 123; in
{
  inherit x;
  y = 456;
}
```

is equivalent to

```nix
let x = 123; in
{
  x = x;
  y = 456;
}
```

Both evaluate to:

```nix
{ x = 123; y = 456; }
```

> ❗: This works because `x` is added to the lexical scope by the `let` construct.

```nix
inherit x y z;
inherit (src-set) a b c;
```

is equivalent to:

```nix
x = x; y = y; z = z;
a = src-set.a; b = src-set.b; c = src-set.c
```

In a `let` expression, `inherit` can be used to selectively bring specific attributes of a set into scope:

```nix
let
  x = { a = 1; b = 2; };
  inherit (builtins) attrNames;
in
{
  names = attrNames x;
}
```

is equivalent to:

```nix
let
  x = { a = 1; b = 2; };
in
{
  names = builtins.attrNames x;
}
```

Both evaluate to:

```nix
{ names [ "a" "b" ]; }
```

**Functions**:

The code below calls a function called `my_function` with the parameters `2` and
`3`, and assigns its output to the `my_value` field:

```nix
{
  my_value = my_function 2 3;
}
```

Functions are defined using this syntax, where `x` and `y` are attributes passed
into the function:

```nix
{
  my_function = x: y: x + y;
}
```

- The body of the function automatically returns the result of the function.
  Functions are called by spaces between it and its parameters. No commas are
  needed to separate parameters.

```nix
let negate = x: !x;
    concat = x: y: x + y;
in if negate true then concat "foo" "bar" else ""

negate = x: !x;
```

This defines a function named `negate` that takes one argument `x` and returns its logical negation (using `!`)

- `concat = x: y: x + y` defines a function that takes two arguments, `x` and `y`, and returns their string concatenation. Notice how Nix handles multi-argument functions through currying -- it's a function that returns another function. This was a little confusing to me, I'm thinking how does it return a function if `concat 1 2` returns `3`...

  - `x: ...`: This part says that `concat` takes one argument, which we've named `x`.

  - `y: x + y`: The result of the first part isn't the final value. Instead, it's another function. This inner function takes one argument, which we've named `y`, and then it adds `x` and `y`.

  - When you do `concat 1` you're applying the `concat` function to the argument `1`. This returns the inner function, where `x` is now fixed as `1`. The inner function is essentially waiting for its `y` argument to be provided.

  - It's when you apply the second argument, `2`, to this resulting function
    `(concat 1) 2` that the addition `1 + 2` finally happens, giving us `3`.

It's like a chain of function applications:

- `concat` takes `x` and returns a new function.

- This new function takes `y` and returns the result of `x + y`.

### Derivations

Again, a derivation is like a blueprint that describes how to build a specific software package or any other kind of file or directory.

Key Characteristics of Derivations:

- Declarative: You describe the desired outcome and the inputs, not the exact sequence of imperative steps. Nix figures out the necessary steps based on the builder and args.

- Reproducible: Given the same inputs and build instructions, a derivation will always produce the same output. This is a cornerstone of Nix's reproducibility.

- Tracked by Nix: Nix keeps track of all derivations and their outputs in the Nix store. This allows for efficient management of dependencies and ensures that different packages don't interfere with each other.

- Content-Addressed: The output of a derivation is stored in the Nix store under a unique path that is derived from the hash of all its inputs and build instructions. This means that if anything changes in the derivation, the output will have a different path.

Hello World Derivation Example:

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.stdenv.mkDerivation {
  name = "hello-world";
  src = null; # No source code needed

  buildPhase = ''
    echo "Hello, World!" > $out
  '';

  installPhase = ''
    mkdir -p $out/bin
    cp $out $out/bin/hello
    chmod +x $out/bin/hello
  '';

  meta = {
    description = "A simple Hello World program built with Nix";
    homepage = null;
    license = lib.licenses.unfree; # For simplicity
    maintainers = [];
  };
}
```

- `{ pkgs ? import <nixpkgs> {} }`: This is a function that takes an optional argument `pkgs`. We need Nixpkgs to access standard build environments like `stdenv`.

- `pkgs.stdenv.mkDerivation { ... }:` This calls the mkDerivation function from the standard environment (stdenv). mkDerivation is the most common way to define software packages in Nix.

- `name = "hello-world";`: Human-readable name of the derivation

- `src = null`: No external source code for this simple example

- The rest are the build phases and package metadata.

To use the above derivation, save it as a `.nix` file (e.g. `hello.nix`). Then build the derivation using:

```bash
nix build ./hello.nix
```

- Nix will execute the `buildPhase` and `installPhase`

- After a successful build, the output will be in the Nix store. You can find the exact path by looking at the output of the nix build command (it will be something like /nix/store/your-hash-hello-world).

Run the "installed" program:

```bash
./result/bin/hello
```

- This will execute the `hello` file from the Nix store and print "Hello, World!".

Here's a simple Nix derivation that creates a file named hello in the Nix store containing the text "Hello, World!":

### Evaluating Nix Files

Use `nix-instantiate --eval` to evaluate the expression in a Nix file:

```bash
echo 1 + 2 > file.nix
nix-instantiate --eval file.nix
3
```

> **Note:** `--eval` is required to evaluate the file and do nothing else. If `--eval` is omitted, `nix-instantiate` expects the expression in the given file to evaluate to a derivation.

If you don't specify an argument, `nix-instantiate --eval` will try to read from `default.nix` in the current directory.

### Resources

- [nix.dev nixlang-basics](https://nix.dev/tutorials/nix-language.html)

- [learn nix in y minutes](https://learnxinyminutes.com/nix/)

- [nix onepager](https://github.com/tazjin/nix-1p)

- [awesome-nix](https://github.com/nix-community/awesome-nix)

- [zero-to-nix nix lang](https://zero-to-nix.com/concepts/nix-language/)

- [nix-pills basics of nixlang](https://nixos.org/guides/nix-pills/04-basics-of-language.html)
