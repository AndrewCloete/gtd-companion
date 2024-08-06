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
Easiest is to:
```sh
cp ~/.gtd.json ~/.gtd.test.json
```
then update the `test` config to be shorter to parse and update the
`default_config_name` in `main.rs`, and run:
```sh
cargo run --bin gtd-server
cargo run --bin gtd-cli -- -w true
cargo run --bin gtd-cli -- -j true > /tmp/gtd-out.json
cargo install --path .
```

```sh
vim ~/.config/systemd/user/gtd-server.service
```

```conf
[Unit]
Description=gtd-server
DefaultDependencies=no
Before=shutdown.target

[Service]
Type=simple
ExecStart=/home/user/.cargo/bin/gtd-server
TimeoutStartSec=0
RestartSec=60
Restart=on-failure
RemainAfterExit=true

[Install]
WantedBy=multi-user.target
```
```sh
systemctl --user daemon-reload
export PROM_SERVICE="gtd-server"
systemctl --user enable ${PROM_SERVICE}.service
systemctl --user start ${PROM_SERVICE}.service
systemctl --user status ${PROM_SERVICE}.service
```





