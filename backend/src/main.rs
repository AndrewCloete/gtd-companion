use clap::Parser;
use colored::*;
use model::{Task, TaskStatus};
use serde::Deserialize;
use std::collections::HashMap;
use std::env::var;
use std::fs;
use walkdir::{DirEntry, WalkDir};

pub mod model;

/// Turns a text-based knowledge base into a GTD system
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Root directory of the knowledge base
    #[arg(short, long, value_hint = clap::ValueHint::DirPath)]
    dir: Option<std::path::PathBuf>,

    /// Task status todo, wip, or review
    #[arg(short, long)]
    status: Option<String>,

    /// Not task status todo, wip, or review
    #[arg(short = 'S', long)]
    not_status: Option<String>,

    /// Task context
    #[arg(short, long)]
    context: Option<String>,

    /// Not Task context
    #[arg(short = 'C', long)]
    not_context: Option<String>,
}

impl Args {
    pub fn parse_status_arg(status: &Option<String>) -> Vec<TaskStatus> {
        status
            .clone()
            .map(|status| {
                status
                    .split(",")
                    .map(|s| TaskStatus::classify(&format!("@{}", s)))
                    .collect()
            })
            .unwrap_or(vec![])
    }
    pub fn statuses(&self) -> Vec<TaskStatus> {
        Args::parse_status_arg(&self.status)
    }

    pub fn not_statuses(&self) -> Vec<TaskStatus> {
        Args::parse_status_arg(&self.not_status)
    }

    pub fn parse_context_arg(context: &Option<String>) -> Vec<String> {
        context
            .clone()
            .map(|status| status.split(",").map(|s| format!("#x{}", s)).collect())
            .unwrap_or(vec![])
    }

    pub fn contexts(&self) -> Vec<String> {
        Args::parse_context_arg(&self.context)
    }

    pub fn not_context(&self) -> Vec<String> {
        Args::parse_context_arg(&self.not_context)
    }
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with("."))
        .unwrap_or(false)
}

#[derive(Debug, Deserialize, Clone)]
struct ConfigFile {
    default_dirs: Option<Vec<std::path::PathBuf>>,
    ignore_files: Option<Vec<String>>,
    always_files: Option<Vec<String>>,
    default_not_context: Option<Vec<String>>,
}

impl ConfigFile {
    fn new() -> ConfigFile {
        return ConfigFile {
            default_dirs: None,
            always_files: None,
            ignore_files: None,
            default_not_context: None,
        };
    }
}

#[derive(Debug)]
struct Project {
    file_name: String,
    tasks: HashMap<TaskStatus, Vec<Task>>,
}

fn display_projects(projects: Vec<Project>) {
    for proj in projects {
        let proj_line = format!("-- {} --", proj.file_name);
        println!("{}", proj_line.on_blue());
        for status in TaskStatus::all() {
            if !proj.tasks.contains_key(&status) {
                continue;
            }
            println!("{}", status.to_color_str().dimmed());
            for task in proj.tasks.get(&status).unwrap() {
                println!("{}", task)
            }
        }
        println!()
    }
}

fn pivot_on_context(projects: Vec<Project>) {
    let mut tasks_flat: Vec<(String, Task)> = projects
        .iter()
        .flat_map(|p| {
            p.tasks
                .iter()
                .flat_map(|t| 
                    t.1
                    .iter()
                    .map(|task| 
                        (p.file_name, task.clone())
                    )
                )
        })
        .collect();
}

fn main() {
    let default_config_name = ".gtd.test.json";
    let args = Args::parse();
    let home_path = var("HOME").expect("$HOME not defined");
    let config = match fs::read_to_string(format!("{}/{}", home_path, default_config_name)) {
        Err(_) => ConfigFile::new(),
        Ok(content) => serde_json::from_str(&content).expect("Config was not well formatted"),
    };
    println!("{:?}", config);

    let statuses = args.statuses();
    let contexts = args.contexts();
    let ignore_files = config.ignore_files.unwrap_or(vec![]);
    let always_files = config.always_files;
    let dirs = args
        .dir
        .map(|d| vec![d])
        .unwrap_or(config.default_dirs.unwrap_or(vec![]));
    println!("{:?}", dirs);
    let default_not_context = match contexts.len() {
        0 => config.default_not_context.unwrap_or(vec![]),
        _ => vec![],
    };

    let file_paths = dirs.iter().flat_map(|dir| {
        WalkDir::new(dir.as_path())
            .into_iter()
            .filter_entry(|e| !is_hidden(e))
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| !ignore_files.contains(&e.file_name().to_str().unwrap_or("").to_string()))
    });

    let re = Task::re_any();

    let projects: Vec<Project> = file_paths
        .flat_map(|file_path| {
            let file_content = fs::read_to_string(&file_path.path()).unwrap_or("".to_string());

            let task_lines = file_content
                .lines()
                .map(|line| String::from(line))
                .filter(|line| line.starts_with("- ") || line.starts_with("* "));

            let tasks: Vec<Task> = if always_files
                .clone()
                .map(|af| {
                    af.iter()
                        .any(|f| file_path.path().to_str().unwrap().contains(f))
                })
                .unwrap_or(false)
            {
                task_lines.map(|l| Task::from(&l)).collect::<Vec<Task>>()
            } else {
                task_lines
                    .filter(|line| re.is_match(line))
                    .map(|l| Task::from(&l))
                    .filter(|task| !task.has_noflags())
                    .filter(|task| statuses.is_empty() || statuses.contains(&task.status))
                    .filter(|task| {
                        contexts.is_empty() || task.contexts.iter().any(|c| contexts.contains(c))
                    })
                    .filter(|task| {
                        !(task
                            .contexts
                            .iter()
                            .any(|c| default_not_context.contains(c))
                            & task.status.eq(&TaskStatus::NoStatus))
                    })
                    .collect::<Vec<Task>>()
            };

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

    display_projects(projects)
}
