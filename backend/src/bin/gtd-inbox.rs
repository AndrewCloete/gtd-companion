use clap::{Arg, Command};

fn main() {
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

    println!("Captured message: {}", message);
}
