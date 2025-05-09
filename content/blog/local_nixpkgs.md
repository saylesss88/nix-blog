+++
title = "Working with Nixpkgs Locally & why you might want to"
date = 2025-05-07
+++

# Working with Nixpkgs Locally: Benefits and Best Practices

Nixpkgs, the package repository for NixOS, is a powerful resource for building and customizing software. Working with a local copy of Nixpkgs lets you debug, test, and contribute to packages efficiently. This post explains how to set up a local Nixpkgs repository, search for dependencies, and leverage its benefits, with tips from the Nix community.

## Why Work with Nixpkgs Locally?

A local Nixpkgs repository offers several advantages:

- **Faster Development**: Local searches and builds are quicker than querying remote repositories or channels, speeding up debugging and prototyping.

- **Full Version Control**: Pin specific commits or branches (e.g., `nixos-unstable`) to ensure reproducibility and avoid unexpected upstream changes.

- **Debugging Flexibility**: Test and modify package derivations locally to fix issues like missing dependencies without waiting for upstream updates.

- **Contribution Workflow**: Develop and test changes (e.g., new packages, patches) before submitting pull requests to Nixpkgs.

- **Up-to-Date Reference**: The repository’s source code and comments often provide the latest documentation, outpacing official guides.

- **Storage Efficiency**: Proper setup (e.g., shallow clones, avoiding flakes) minimizes disk usage and build times.

For reference, here is a comparison of Flake vs. Non-Flake Syntax:

- Flake Syntax: Uses `nix build .#<package>` or similar, where the current directory (.) is treated as a flake.
  For a local Nixpkgs repository, this involves evaluating the flake.nix in the repository root, which defines
  outputs like `packages.<system>.<package>`. Flakes copy the entire working directory (including checked-out files)
  to /nix/store for evaluation, which can be slow and storage-intensive for large repositories like Nixpkgs.

- Non-Flake Syntax: Uses `nix-build -f . <package>` or `nix build -f . <package>`, where -f . specifies the Nix
  expression in the current directory (e.g., default.nix or a specific file). This evaluates the Nix expression
  directly without copying the worktree to /nix/store, making it faster and more storage-efficient for local development.

## Setting Up a Local Nixpkgs Repository

Nixpkgs is a large repository, so cloning it efficiently is key to avoiding slowdowns and storage bloat.

- Working on Nixpkgs locally can be powerful, but using it as a flake directly
  can lead to unexpected slowdowns and storage issues...

- First the Nixpkgs repo is massive. Only clone the latest revision to avoid cloning the entire history of Nixpkgs:

```bash
git clone https://github.com/NixOS/nixpkgs --depth 1
cd nixpkgs
```

- Now you can either fetch all of the branches or just the one you need:

```bash
git fetch --all --prune --depth=1
git worktree add -b nixos-unstable nixos-unstable # for just unstable
```

- The `worktree` is a feature in Git that allows you to have multiple working
  directories attached to the same Git repository. The main working directory is
  created when you clone a repository or run `git init`. You can then create
  additional worktrees using the `git worktree add` command. Each worktree has its
  own set of checked-out files, but they all share the same .git directory, which
  contains the repository's history and objects.

- `git worktree add` Adds a new working directory for a branch or commit, in this case `nixos-unstable`.

- Now lets say you want to build a derivation for `icat` and you get a missing dependency error like this:

```nix
nix-build -A icat
this derivation will be built:
  /nix/store/bw2d4rp2k1l5rg49hds199ma2mz36x47-icat.drv
...
error: builder for '/nix/store/bw2d4rp2k1l5rg49hds199ma2mz36x47-icat.drv' failed with exit code 2;
       last 10 log lines:
       >                  from icat.c:31:
       > /nix/store/hkj250rjsvxcbr31fr1v81cv88cdfp4l-glibc-2.37-8-dev/include/features.h:195:3: warning: #warning "_BSD_SOURCE and _SVID_SOURCE are deprecated, use _DEFAULT_SOURCE" [8;;https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html#index-Wcpp-Wcpp8;;]
       >   195 | # warning "_BSD_SOURCE and _SVID_SOURCE are deprecated, use _DEFAULT_SOURCE"
       >       |   ^~~~~~~
       > In file included from icat.c:39:
       > /nix/store/4fvrh0sjc8sbkbqda7dfsh7q0gxmnh9p-imlib2-1.11.1-dev/include/Imlib2.h:45:10: fatal error: X11/Xlib.h: No such file or directory
       >    45 | #include <X11/Xlib.h>
       >       |          ^~~~~~~~~~~~
       > compilation terminated.
       > make: *** [Makefile:16: icat.o] Error 1
       For full logs, run 'nix log /nix/store/bw2d4rp2k1l5rg49hds199ma2mz36x47-icat.drv'.
```

- `fatal error: X11/xlib.h: No such file or directory`(a missing dependency)

- The easiest way to find what you need is to [search.nixos.org/packages](https://search.nixos.org/packages)

- Unfortunately in this case, searching for x11 produces too many irrelevant results because
  X11 is ubiquitous. On the left side bar there is a list package sets, and selecting xorg shows
  something promising.

- In this case, it helps to become familiar with searching the Nixpkgs source code for keywords.

In the `nixpkgs/` directory you could run:

```bash
rg "x11 =" pkgs  # case sensitive search
```

**Output**:

```bash
pkgs/tools/X11/primus/default.nix
21:  primus = if useNvidia then primusLib_ else primusLib_.override { nvidia_x11 = null; };
22:  primus_i686 = if useNvidia then primusLib_i686_ else primusLib_i686_.override { nvidia_x11 = null; };

pkgs/applications/graphics/imv/default.nix
38:    x11 = [ libGLU xorg.libxcb xorg.libX11 ];
```

- The important bit here is `xorg.libX11`. We can further refine our search and
  make sure we aren't missing anything with:

```bash
rg -i "libx11 =" pkgs    # case insensitive
```

Output:

```bash
1541:    enableX11 = false;
1726:  bucklespring-x11 = callPackage ../applications/audio/bucklespring { legacy = true; };
5344:    libX11 = xorg.libX11;
6327:    nvidia_x11 = linuxPackages.nvidia_x11;
6564:  mitschemeX11 = mitscheme.override {
```

### Local derivation search

To search derivations on the command line, use `nix-locate` from `nix-index`

> **NOTE:** You need to first install `nix-index` and run the command `nix-index` to create the initial index of your system and takes a while.

```bash
nix-locate libx11
2.0.2/share/xdg-ninja/programs/libx11.json
x11basic.out                                          0 s /nix/store/809yni8vijakvfdiha65ym1j85dgc9im-X11basic-1.27/lib/libx11basic.so
x11basic.out                                          0 s /nix/store/809yni8vijakvfdiha65ym1j85dgc9im-X11basic-1.27/lib/libx11basic.so.1
x11basic.out                                    767,712 r /nix/store/809yni8vijakvfdiha65ym1j85dgc9im-X11basic-1.27/lib/libx11basic.so.1.27
vcpkg.out                                             9 d /nix/store/bhhd9xy5n8qn6hc4bfk06c9dc55pcy8p-vcpkg-2024.1
# ...
```

- Combining online resources like `search.nixos.org` with local searches with `rg` or `grep` provides a powerful toolkit.

- Local searches and builds can be faster than dealing with remote repos.

- A local copy of Nixpkgs gives you full control over the Nixpkgs version you're using.

- Documentation can lag behind the Nixpkgs Repository updates making it a good source for new info.

- Never merge the upstream into your branch! Always rebase your branch on top of
  master (or whatever your upstream branch is). Merging is how you accidentally
  ping like 30,000 people in your PR. This tip came from soulsssx3 on reddit.

- The following Tips come from ElvishJErrico:

Another tip: For nixpkgs (or any very large repos), avoid using it as a flake when working directly on it. Use nix build -f . hello instead of nix build .#hello. The reason to avoid the flake is that it will copy the worktree into /nix/store. The copy itself is slow, and it takes a couple hundred megabytes. So even just 10 "edit -> rebuild" cycles will waste a couple minutes of time and over a gig of storage. And the worst part is when you go to garbage collect your store. Large numbers of small files (exactly what nixpkgs is) is the worst case scenario for the performance of any file system, so GC'ing one or two hundred nixpkgs copies takes forever. I was convinced to stop using flake syntax while working on nixpkgs when a GC took over an hour longer than I expected because of all the nixpkgs copies.

There are still some edge cases where you'll want to use flake syntax though. Like the "installer" NixOS tests, which copy the nixpkgs directory. You'll want to use flake syntax so this copy doesn't include the whole .git history, which makes these tests even slower. Also, there's work in development to address all of this so flake syntax doesn't have these problems, but it's slow going and it's not clear when we'll finally benefit from it.

Another tip: Base your changes on the nixos-unstable branch, not master. It will merge into master just fine assuming no conflicts have come up in the past couple days, and nixos-unstable has much better binary cache hits than master. Even when I'm working on something for staging, I'll base my changes on the merge-base for staging and nixos-unstable if I can.

Finally, jujutsu. This is a git alternative that's git-compatible. It's so much better than git. It's a little slower at some things, and it takes a lot of getting used to, but it's way more intuitive and makes a lot of workflows very very easy, especially on large monorepos like nixpkgs where you might have a dozen different parallel things you're interested in working on. I've been an emacs-magit user for years (probably the best GUI / TUI for making git easy to use), and I've switched to jujutsu. I still miss how magit is integrated with the editor and how everything is done with lightning fast keystrokes, but jujutsu is worth it. And I can still use magit for a number of things since jujutsu is git compatible.
