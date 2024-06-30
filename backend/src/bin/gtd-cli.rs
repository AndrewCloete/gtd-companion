use clap::Parser;
use colored::*;
use gtd_cli::model::{ConfigFile, Project, Task, TaskDates, TaskStatus};
use reqwest;
use std::collections::HashMap;
use std::fs;
use walkdir::{DirEntry, WalkDir};

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

    #[arg(short, long)]
    pivot: Option<bool>,

    #[arg(short = 'j', long)]
    json: Option<bool>,

    #[arg(short = 'w', long)]
    web: Option<bool>,
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

fn display_projects(projects: &Vec<Project>) {
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

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
struct FlatContextTask {
    context: String,
    task: Task,
}

fn pivot_on_context(projects: &Vec<Project>) -> HashMap<String, Vec<FlatContextTask>> {
    let flat_tasks: Vec<FlatContextTask> = projects
        .iter()
        .flat_map(|p| {
            p.tasks.iter().flat_map(|t| {
                t.1.iter().flat_map(|task| {
                    task.contexts.iter().map(|c| FlatContextTask {
                        context: c.into(),
                        task: task.clone(),
                    })
                })
            })
        })
        .collect();

    flat_tasks.iter().fold(
        HashMap::new(),
        |mut map: HashMap<String, Vec<FlatContextTask>>, task| {
            let mut value: Vec<FlatContextTask> =
                map.get(&task.context).unwrap_or(&vec![]).to_vec();
            value.push(task.clone());
            map.insert(String::from(&task.context), value);
            map
        },
    )
}
fn flat_tasks(projects: &Vec<Project>) -> Vec<Task> {
    projects
        .iter()
        .flat_map(|p| p.tasks.iter().flat_map(|t| t.1.clone()))
        .collect()
}

fn print_by_context(projects: &Vec<Project>) {
    for (context, flat_tasks) in pivot_on_context(projects) {
        let ctx_line = format!("-- {} --", context);
        println!("{}", ctx_line.on_blue());
        let mut sorted_flat_tasks = flat_tasks.clone();
        sorted_flat_tasks.sort_by(|a, b| a.task.project.cmp(&b.task.project));
        for t in sorted_flat_tasks {
            println!("{}", t.task.ctx_line());
        }
        println!()
    }
}

fn main() {
    let config = ConfigFile::read();
    let args = Args::parse();
    let statuses = args.statuses();
    let contexts = args.contexts();
    let ignore_files = config.ignore_files.unwrap_or(vec![]);
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
            let file_name: String = file_path.file_name().to_str().unwrap().into();

            let file_content = fs::read_to_string(&file_path.path()).unwrap_or("".to_string());

            let task_lines = file_content
                .lines()
                .map(|line| String::from(line))
                .filter(|line| line.starts_with("- ") || line.starts_with("* "));

            let first_line = task_lines.clone().next().unwrap_or("".into());
            let gtd_task = if first_line.starts_with("- @gtd") {
                Some(Task::from(&first_line, &file_name))
            } else {
                None
            };

            let tasks: Vec<Task> = if gtd_task.is_some() {
                let gt = gtd_task.as_ref().unwrap().clone();
                task_lines
                    .filter(|l| !l.starts_with("- @gtd"))
                    .map(|l| {
                        let mut t = Task::from(&l, &file_name);
                        if t.status == TaskStatus::NoStatus {
                            // Replace NoStatus with GTD task status
                            t.status = gt.status.clone();
                        }

                        let start = t.dates.as_ref().map(|d| d.start.clone()).flatten().or(gt
                            .dates
                            .as_ref()
                            .map(|d| d.start.clone())
                            .flatten());
                        let due = t.dates.as_ref().map(|d| d.due.clone()).flatten().or(gt
                            .dates
                            .as_ref()
                            .map(|d| d.due.clone())
                            .flatten());
                        let visible = t.dates.as_ref().map(|d| d.due.clone()).flatten().or(gt
                            .dates
                            .as_ref()
                            .map(|d| d.visible.clone())
                            .flatten());
                        t.dates = match (start, due, visible) {
                            (None, None, None) => None,
                            (s, d, v) => Some(TaskDates {
                                start: s,
                                due: d,
                                visible: v,
                            }),
                        };
                        t.contexts.append(gt.contexts.clone().as_mut());
                        t
                    })
                    .collect::<Vec<Task>>()
            } else {
                task_lines
                    .filter(|line| re.is_match(line))
                    .map(|l| Task::from(&l, &file_name))
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

    if args.pivot.unwrap_or(false) {
        display_projects(&projects);
        println!("---------------------------------------------------------");
        print_by_context(&projects);
    } else if args.json.unwrap_or(false) {
        print!(
            "{}",
            serde_json::to_string_pretty(&flat_tasks(&projects)).unwrap()
        );
    } else {
        //display_projects(&projects);
    }
    if args.web.unwrap_or(true) && config.server.is_some() {
        let tasks_string = serde_json::to_string_pretty(&flat_tasks(&projects)).unwrap();
        let server_cnf = config.server.unwrap().clone();
        let url = server_cnf.host.clone() + "/tasks";
        let client = reqwest::blocking::Client::new();
        let res = client
            .post(url)
            .body(tasks_string)
            .header("Content-Type", "application/json")
            .header(
                "Authorization",
                "Basic ".to_owned() + &server_cnf.basic_token(),
            )
            .send()
            .unwrap();
        println!("{:?}", res.text());
    }
}
