use chrono::Local;
use clap::{Arg, Command};
use gtd_cli::model::ConfigFile;
use std::fs::OpenOptions;
use std::io::Write;

fn main() {
    let config = ConfigFile::read();
    let matches = Command::new("inbox")
        .arg(
            Arg::new("message")
                .help("The message to process")
                .required(true)
                .num_args(1..),
        )
        .get_matches();

    let message: String = matches
        .get_many::<String>("message")
        .unwrap()
        .cloned()
        .collect::<Vec<_>>()
        .join(" ");

    let inbox_path = config.inbox_path.expect("inbox_path must exist in config");
    let mut inbox_file = OpenOptions::new()
        .append(true)
        .open(inbox_path)
        .expect("cannot open file");

    let today = Local::now().naive_local().date().format("%Y-%m-%d");
    let inbox_line = format!("\n- {} @d{}", message, today);
    println!("{}", inbox_line);

    inbox_file
        .write(inbox_line.as_bytes())
        .expect("write failed");
}
