+++
title = "Package Definitions Explained"
date = 2025-05-08
+++

## Package Definitions Explained

A _package_ refers to either a collection of files and other data, or a Nix
expression representing such a collection before it comes into being. You start
by writing a _package definition_ in the Nix language, this definition contains
instructions and metadata about the software or artifact you want to "package".

- This package definition, when evaluated by Nix, results in a _derivation_. A
  package definition is essentially a Nix language function. And Nix Language
  is similar to JSON with functions.

- The derivation is the concrete build plan that Nix uses to fetch sources,
  build dependencies, compile code, and ultimately produce the desired output
  (the package).

So, the _package definition_ is the blueprint, and the _derivation_ is the
detailed plan that Nix follows to build the package. You don't directly get a
"package" in the sense of a pre-built artifact until Nix executes the derivation.

The following is a skeleton derivation:

```nix
{ stdenv }:

stdenv.mkDerivation { }
```

- This is a function which takes an attribute set containing `stdenv`, and
  produces a derivation (which currently does nothing).
  [The Standard Environment](https://ryantm.github.io/nixpkgs/stdenv/stdenv/)
  [Fundamentals of Stdenv](https://nixos.org/guides/nix-pills/19-fundamentals-of-stdenv.html)

### A Package Function

The following is a package definition that is a Nix function that will
evaluate to a derivation.

```nix
# hello.nix
{
  stdenv,
  fetchzip,
}:

stdenv.mkDerivation {
  pname = "hello";
  version = "2.12.1";

  src = fetchzip {
    url = "https://ftp.gnu.org/gnu/hello/hello-2.12.1.tar.gz";
    sha256 = "";
  };
}
```

- If you save and try to run this file with `nix-build hello.nix` it will fail
  because `stdenv` is a part of Nixpkgs which we haven't included yet. So it
  only produces its intended output if it's passed the correct arguments which
  we haven't done yet.

- `stdenv` is available from `nixpkgs`, which must be imported with another
  Nix expression in order to pass it as an argument to this derivation.

The recommended way is to create a `default.nix` file in the same directory as
`hello.nix`, with the following contents:

```nix
# default.nix
let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.05";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in
{
  hello = pkgs.callPackage ./hello.nix { };
}
```

Now you can run `nix-build -A hello` to realize the derivation from the package
definition in `hello.nix`.

- While the terms "realize" and "evaluate" are related, "realize" is often used specifically in the context of building a derivation and producing the output in the Nix store.

- The `-A` tells Nix to build a specific attribute named `hello` from the
  top-level expression.

- Notice the `hello.nix` has a placeholder `""` for the sha256. This is because
  it's impossible for Nix to know the value before the derivation is realized.
  After running `nix-build -A hello` the compiler will give it to you:

```bash
nix-build -A hello
error: hash mismatch in fixed-output derivation '/nix/store/pd2kiyfa0c06giparlhd1k31bvllypbb-source.drv':
         specified: sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
            got:    sha256-1kJjhtlsAkpNB7f6tZEs+dbKd8z7KoNHyDHEJ0tmhnc=
error: 1 dependencies of derivation '/nix/store/b4mjwlv73nmiqgkdabsdjc4zq9gnma1l-hello-2.12.1.drv' failed to build
```

- Replace the placeholder sha256 with `sha256 = "1kJjhtlsAkpNB7f6tZEs+dbKd8z7KoNHyDHEJ0tmhnc="`
  in the `hello.nix`.

### Build the Result

```bash
./result/bin/hello
Hello, world!
```

### Swaytools Package Definition

The following is the swaytools package definition located at `nixpkgs/pkgs/tools/wayland/swaytools/default.nix` part of the Nixpkgs collection:

```nix
# default.nix
{
  lib,
  setuptools,
  buildPythonApplication,
  fetchFromGitHub,
  slurp,
}:

buildPythonApplication rec {
  pname = "swaytools";
  version = "0.1.2";

  format = "pyproject";

  src = fetchFromGitHub {
    owner = "tmccombs";
    repo = "swaytools";
    rev = version;
    sha256 = "sha256-UoWK53B1DNmKwNLFwJW1ZEm9dwMOvQeO03+RoMl6M0Q=";
  };

  nativeBuildInputs = [ setuptools ];

  propagatedBuildInputs = [ slurp ];

  meta = with lib; {
    homepage = "https://github.com/tmccombs/swaytools";
    description = "Collection of simple tools for sway (and i3)";
    license = licenses.gpl3Only;
    maintainers = with maintainers; [ atila ];
    platforms = platforms.linux;
  };
}
```

1. Function Structure:

- The file starts with a function that takes an attribute set as input:

```nix
{ lib, setuptools, buildPythonApplication, fetchFromGitHub, slurp }:
```

- These arguments are dependencies or utilities provided by Nixpkgs commonly
  used in package definitions.

2. Derivation Creation:

- The function calls `buildPythonApplication`, a helper function for creating
  python based packages, which produces a derivation:

```nix
buildPythonApplication rec { ... }
```

- This is similar to `stdenv.mkDerivation` but tailored for Python apps

3. Package Metadata:

```nix
pname = "swaytools";
version = "0.1.2";
```

- `meta` provides additional metadata (e.g. description, license) which is standard for package defs:

```nix
meta = with lib; {
  homepage = "https://github.com/tmccombs/swaytools";
  description = "Collection of simple tools for sway (and i3)";
  license = licenses.gpl3Only;
  maintainers = with maintainers; [ atila ];
  platforms = platforms.linux;
};
```

4. Source Specification:

- The `src` attribute tells where to fetch the source code, using `fetchFromGithub`:

```nix
src = fetchFromGitHub {
  owner = "tmccombs";
  repo = "swaytools";
  rev = version;
  sha256 = "sha256-UoWK53B1DNmKwNLFwJW1ZEm9dwMOvQeO03+RoMl6M0Q=";
};
```

5. Build and Runtime Dependencies:

- `nativeBuildInputs` lists tools needed during the build process

- `propagatedBuildInputs` lists runtime deps (e.g. `slurp`)

```nix
nativeBuildInputs = [ setuptools ];
propagatedBuildInputs = [ slurp ];
```

6. Build Format:

- The `format = "pyproject";` attribute indicates that the packages uses a `pyproject.toml` file for its build configuration.

- Location: The file is located at `pkgs/tools/wayland/swaytools/default.nix`

- Integration: This package is referenced in `/pkgs/top-level/all-packages.nix`
  like this:

```nix
# all-packages.nix
swaytools = python3Packages.callPackage ../tools/wayland/swaytools { };
```

- This allows Nix to instantiate the package by passing the required arguments (`lib`, `setuptools`, etc) from Nixpkgs.

### Resources

- [Packaging Existing Software](https://nix.dev/tutorials/packaging-existing-software.html)
