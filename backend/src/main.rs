use clap::Parser;
use std::fs;
use walkdir::{DirEntry, WalkDir};

mod model {
    #[derive(Copy, Clone, PartialEq, Eq, Debug)]
    pub enum TaskStatus {
        Todo,
        Wip,
        Review,
    }

    impl std::fmt::Display for TaskStatus {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            let s = match self {
                Self::Todo => "todo",
                Self::Wip => "wip",
                Self::Review => "review",
            };
            s.fmt(f)
        }
    }
    impl std::str::FromStr for TaskStatus {
        type Err = String;

        fn from_str(s: &str) -> Result<Self, Self::Err> {
            match s {
                "todo" => Ok(Self::Todo),
                "wip" => Ok(Self::Wip),
                "review" => Ok(Self::Review),
                _ => Err(format!("Unknown status: {s}")),
            }
        }
    }
}

/// Turns a text-based knowledge base into a GTD system
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Root directory of the knowledge base
    #[arg(short, long, value_hint = clap::ValueHint::DirPath)]
    dir: std::path::PathBuf,

    /// Task status todo, wip, or review
    #[arg(short, long)]
    status: Option<model::TaskStatus>,

    /// Number of times to greet
    #[arg(short, long, default_value_t = 1)]
    count: u8,
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with("."))
        .unwrap_or(false)
}

fn main() {
    let args = Args::parse();

    for _ in 0..args.count {
        println!("Hello {}!", args.dir.display())
    }
    let file_paths = WalkDir::new(args.dir.as_path())
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.path().display().to_string());

    let lines: Vec<String> = file_paths
        .flat_map(|file_path| {
            fs::read_to_string(file_path)
                .unwrap()
                .lines()
                .map(|line| String::from(line))
                .filter(|line| line.starts_with("- ") || line.starts_with("* "))
                .collect::<Vec<String>>()
        })
        .collect();

    for line in lines {
        println!("{}", line)
    }
}
