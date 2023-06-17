use clap::Parser;
use model::TaskStatus;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use walkdir::{DirEntry, WalkDir};

mod model {
    #[derive(Copy, Clone, PartialEq, Eq, Debug)]
    pub enum TaskStatus {
        NoStatus,
        Todo,
        Wip,
        Review,
    }

    impl TaskStatus {
        pub fn classify(task: &String) -> TaskStatus {
            if task.contains("@todo") {
                return TaskStatus::Todo;
            }
            if task.contains("@wip") {
                return TaskStatus::Wip;
            }
            if task.contains("@review") {
                return TaskStatus::Review;
            }
            return TaskStatus::NoStatus;
        }

        pub fn get_list() -> Vec<String> {
            return vec![
                "@todo".to_string(),
                "@wip".to_string(),
                "@review".to_string(),
            ];
        }
    }

    impl std::fmt::Display for TaskStatus {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            let s = match self {
                Self::Todo => "@todo",
                Self::Wip => "@wip",
                Self::Review => "@review",
                Self::NoStatus => "@noStatus",
            };
            s.fmt(f)
        }
    }
    impl std::str::FromStr for TaskStatus {
        type Err = String;

        fn from_str(s: &str) -> Result<Self, Self::Err> {
            match s {
                "@todo" => Ok(Self::Todo),
                "@wip" => Ok(Self::Wip),
                "@review" => Ok(Self::Review),
                "@noStatus" => Ok(Self::NoStatus),
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

#[derive(Debug)]
struct Project {
    file_name: String,
    tasks: HashMap<String, Vec<String>>,
}

fn main() {
    let args = Args::parse();

    let re_context = Regex::new(r"(#x[A-Za-z0-9]{1,})|@todo|@wip|@review").unwrap();

    for _ in 0..args.count {
        println!("Hello {}!", args.dir.display())
    }
    let file_paths = WalkDir::new(args.dir.as_path())
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file());

    let projects: Vec<Project> = file_paths
        .flat_map(|file_path| {
            let tasks = fs::read_to_string(&file_path.path())
                .unwrap()
                .lines()
                .map(|line| String::from(line))
                .filter(|line| line.starts_with("- ") || line.starts_with("* "))
                .filter(|line| re_context.is_match(line))
                .collect::<Vec<String>>();
            if tasks.is_empty() {
                return None;
            }

            let grouped_tasks = tasks.iter().fold(
                HashMap::new(),
                |mut map: HashMap<String, Vec<String>>, task| {
                    let status = TaskStatus::classify(task).to_string();
                    let mut value: Vec<String> = map.get(&status).unwrap_or(&vec![]).to_vec();
                    value.push(task.to_string());
                    map.insert(status, value);
                    map
                },
            );
            return Some(Project {
                file_name: file_path.file_name().to_str().unwrap().into(),
                tasks: grouped_tasks,
            });
        })
        .collect();

    for proj in projects {
        println!("---------- {} ----------", proj.file_name);
        for status in TaskStatus::get_list().iter() {
            if !proj.tasks.contains_key(status) {
                continue;
            }
            println!("{}", status);
            for task in proj.tasks.get(status).unwrap() {
                println!("{}", task)
            }
            println!()
        }
        println!()
    }
}
