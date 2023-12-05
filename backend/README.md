CLI for using a Markdown/Tiddlywiki based knowledge base as a GTD system written
in Rust.

Also, this project serves as an excuse to improve my comfor with Rust.

# Principles
- Any list item in a Markdown knowledge base is a potential task. It is assumed
  the file that contains the item is the "project" for that task.
- A list item becomes a task when is it marked with a status and/or a context
  (see below)
- The CLI crawls all files in the knowledge base and presents the tasks.
- The system must be keyboard driven for optimal impedance match

## Task status
The purpose of Status is to manage WIP i.e. to minimise it.
> The main contributor to due date issues and poor quality is WIP.
- @todo: Want to do next
- @wip: Busy doing. WIP!!
- @review: Waiting for feedback WIP!!

## Task context
This is any word that starts wit a capital `X`.  The purpose of context is to
enable filtering tasks so as to focus only on those appropriate to your current
environment and state of mind. E.g.

Location
- Xhome 
- Xoffice

Mood
- Xzz: "sleepy". Simple, concrete, small tasks for low energy, interruptible
  mode
- Xmail: Processing you IM, email etc to get to inbox zero. 
- Xfocus: Large blocks of quiet, uninterrupted time.
- Xerr: "errands". Thing to batch together while moving around or buying things
  online
- Xwalk: Podcasts, reading to do while walking

## Local testing
If `~/.gtd.json` is already set up, you can just run:
```sh
cargo run
```



