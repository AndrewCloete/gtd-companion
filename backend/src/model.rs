use base64::{engine::general_purpose, Engine as _};
use colored::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env::var;
use std::fs;
use std::str::FromStr;

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    user: String,
    psw: String,
}

impl ServerConfig {
    pub fn basic_token(&self) -> String {
        let merge = format!("{}:{}", &self.user, &self.psw);
        general_purpose::URL_SAFE.encode(merge)
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct ConfigFile {
    pub default_dirs: Option<Vec<std::path::PathBuf>>,
    pub inbox_path: Option<String>,
    pub ignore_files: Option<Vec<String>>,
    pub default_not_context: Option<Vec<String>>,
    pub server: Option<ServerConfig>,
}

impl ConfigFile {
    fn new() -> ConfigFile {
        return ConfigFile {
            default_dirs: None,
            inbox_path: None,
            ignore_files: None,
            default_not_context: None,
            server: None,
        };
    }

    pub fn read() -> ConfigFile {
        let default_config_name = ".gtd.json";
        let home_path = var("HOME").expect("$HOME not defined");
        match fs::read_to_string(format!("{}/{}", home_path, default_config_name)) {
            Err(_) => ConfigFile::new(),
            Ok(content) => serde_json::from_str(&content).expect("Config was not well formatted"),
        }
    }
}

use regex::Regex;
#[derive(Copy, Serialize, Deserialize, Clone, PartialEq, Eq, Debug, Hash)]
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
    pub fn remove_status_str(task: &str) -> String {
        let no_status = TaskStatus::re_status().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_status, " ")
            .to_string()
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
            TaskStatus::Wip,
            TaskStatus::Review,
            TaskStatus::Todo,
            TaskStatus::NoStatus,
        ];
    }

    pub fn to_color_str(&self) -> ColoredString {
        match self {
            TaskStatus::NoStatus => self.to_string().black(),
            TaskStatus::Todo => self.to_string().green(),
            TaskStatus::Wip => self.to_string().red(),
            TaskStatus::Review => self.to_string().yellow(),
        }
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

#[derive(Serialize)]
struct TaskContext(String);

impl TaskContext {
    fn re_context() -> Regex {
        Regex::new(r"(#x[A-Za-z0-9_]{1,})+").unwrap()
    }

    pub fn extract_contexts(task: &str) -> Vec<String> {
        TaskContext::re_context()
            .captures_iter(task)
            .map(|c| c.get(0).unwrap().as_str().into())
            .collect()
    }

    pub fn remove_context_string(task: &str) -> String {
        let no_contexts = TaskContext::re_context().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_contexts, " ")
            .to_string()
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug, Hash)]
pub struct TaskDates {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub due: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub visible: Option<String>,
}

impl TaskDates {
    pub fn re_date() -> Regex {
        Regex::new(r"(@[d,s,b,v][0-9]{8})").unwrap()
    }

    fn parse_date(dates: &Vec<String>, c: char) -> Option<String> {
        dates
            .iter()
            .find(|s| s.contains(c))
            .cloned()
            .map(|s| s.replace(&format!("@{}", c), ""))
    }

    pub fn extract_dates(task: &str) -> Option<TaskDates> {
        let dates: Vec<String> = TaskDates::re_date()
            .captures_iter(task)
            .map(|c| c.get(0).unwrap().as_str().into())
            .collect();
        let start: Option<String> = TaskDates::parse_date(&dates, 's');
        let both: Option<String> = TaskDates::parse_date(&dates, 'b');
        let due: Option<String> = both.clone().or(TaskDates::parse_date(&dates, 'd'));
        let visible: Option<String> = both.clone().or(TaskDates::parse_date(&dates, 'v'));

        if start.is_none() && due.is_none() && visible.is_none() {
            None
        } else {
            Some(TaskDates {
                start,
                due,
                visible,
            })
        }
    }

    pub fn remove_date(task: &str) -> String {
        let no_dates = TaskDates::re_date().replace_all(task, "").to_string();
        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&no_dates, " ")
            .to_string()
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Debug, Hash)]
pub struct Task {
    pub description: String,
    pub project: String,
    pub status: TaskStatus,
    pub contexts: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    pub dates: Option<TaskDates>,
}
impl Task {
    pub fn re_any() -> Regex {
        // TODO: regex duplicated here.. not very DRY
        Regex::new(r"(#x[A-Za-z0-9]{1,})|(@[d,s,b][0-9]{8})|@todo|@wip|@review").unwrap()
    }

    pub fn from(task: &str, project: &str) -> Task {
        let status = TaskStatus::classify(task);
        let contexts = TaskContext::extract_contexts(task);
        let dates = TaskDates::extract_dates(task);
        let description = TaskDates::remove_date(&TaskContext::remove_context_string(
            &TaskStatus::remove_status_str(&task),
        ));

        Task {
            project: String::from(project),
            description,
            status,
            contexts,
            dates,
        }
    }

    pub fn has_noflags(&self) -> bool {
        self.contexts.is_empty() && self.status == TaskStatus::NoStatus && self.dates.is_none()
    }

    pub fn ctx_line(&self) -> String {
        let with_project = format!("{} {}", self.project.bold(), self.description);

        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&with_project, " ")
            .to_string()
    }
}

impl std::fmt::Display for Task {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let context_with_color = self
            .contexts
            .iter()
            .fold(self.description.clone(), |desc: String, c: &String| {
                format!("{} {}", desc, c.blue())
            });

        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&context_with_color, " ")
            .to_string()
            .fmt(f)
    }
}

#[derive(Debug, Serialize)]
pub struct Project {
    pub file_name: String,
    pub tasks: HashMap<TaskStatus, Vec<Task>>,
}
