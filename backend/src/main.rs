use clap::Parser;
use model::{Task, TaskStatus};
use std::collections::HashMap;
use std::fs;
use walkdir::{DirEntry, WalkDir};

mod model {
    use colored::*;
    use std::str::FromStr;

    use regex::Regex;
    #[derive(Copy, Clone, PartialEq, Eq, Debug, Hash)]
    pub enum TaskStatus {
        NoStatus,
        Todo,
        Wip,
        Review,
    }

    impl TaskStatus {
        fn re_status() -> Regex {
            Regex::new(r"(@todo|@wip|@review)").unwrap()
        }
        pub fn classify(task: &str) -> TaskStatus {
            let status_str: Option<&str> = TaskStatus::re_status()
                .captures(task)
                .map(|cap| cap.get(0).unwrap().as_str());

            status_str
                .map(|s| TaskStatus::from_str(s).unwrap())
                .unwrap_or(TaskStatus::NoStatus)
        }
        pub fn all() -> Vec<TaskStatus> {
            return vec![
                TaskStatus::Todo,
                TaskStatus::Wip,
                TaskStatus::Review,
                TaskStatus::NoStatus,
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

    #[derive(Clone, PartialEq, Eq, Debug, Hash)]
    pub struct Task {
        description: String,
        pub status: TaskStatus,
        pub contexts: Vec<String>,
    }
    impl Task {
        fn re_context() -> Regex {
            Regex::new(r"(#x[A-Za-z0-9]{1,})+").unwrap()
        }

        fn extract_contexts(task: &str) -> Vec<String> {
            Task::re_context()
                .captures_iter(task)
                .map(|c| c.get(0).unwrap().as_str().into())
                .collect()
        }

        pub fn new(task: &str) -> Task {
            Task {
                description: task.to_string(),
                status: TaskStatus::classify(task),
                contexts: Task::extract_contexts(task),
            }
        }

        pub fn has_noflags(&self) -> bool {
            self.contexts.is_empty() && self.status == TaskStatus::NoStatus
        }
    }
    impl std::fmt::Display for Task {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            self.description.fmt(f)
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
    status: Option<String>,

    /// Task context
    #[arg(short, long)]
    context: Option<String>,
}

fn split_param(param: Option<String>) -> Vec<String> {
    param
        .map(|status| status.split(",").map(|s| s.to_string()).collect())
        .unwrap_or(vec![])
}
impl Args {
    pub fn statuses(&self) -> Vec<String> {
        split_param(self.status.clone())
    }
    pub fn contexts(&self) -> Vec<String> {
        split_param(self.status.clone())
    }
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
    tasks: HashMap<TaskStatus, Vec<Task>>,
}

fn main() {
    let args = Args::parse();
    let statuses = args.statuses();
    let contexts = args.contexts();

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
                .map(|line| model::Task::new(&line))
                .filter(|task| !task.has_noflags())
                .collect::<Vec<Task>>();
            if tasks.is_empty() {
                return None;
            }

            let grouped_tasks = tasks.iter().fold(
                HashMap::new(),
                |mut map: HashMap<TaskStatus, Vec<Task>>, task| {
                    let mut value: Vec<Task> = map.get(&task.status).unwrap_or(&vec![]).to_vec();
                    value.push(task.clone());
                    map.insert(task.status, value);
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
        for status in TaskStatus::all() {
            if !proj.tasks.contains_key(&status) {
                continue;
            }
            println!("{}", status);
            for task in proj.tasks.get(&status).unwrap() {
                println!("{}", task)
            }
            println!()
        }
        println!()
    }
}
