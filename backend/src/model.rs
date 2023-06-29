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

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub struct Task {
    description: String,
    pub status: TaskStatus,
    pub contexts: Vec<String>,
}
impl Task {
    pub fn re_any() -> Regex {
        Regex::new(r"(#x[A-Za-z0-9]{1,})|@todo|@wip|@review").unwrap()
    }
    fn re_context() -> Regex {
        Regex::new(r"(#x[A-Za-z0-9]{1,})+").unwrap()
    }

    fn extract_contexts(task: &str) -> Vec<String> {
        Task::re_context()
            .captures_iter(task)
            .map(|c| c.get(0).unwrap().as_str().into())
            .collect()
    }

    // fn color_context(task: &str) -> String {
    //     let noStatus = Task::re_context().replace(task, ).to_string();
    //     Regex::new(r"\s+").unwrap().replace_all(&noStatus, " ").to_string()
    // }

    pub fn from(task: &str) -> Task {
        let status = TaskStatus::classify(task);
        let contexts = Task::extract_contexts(task);
        let description = TaskStatus::remove_status_str(&task);

        Task {
            description,
            status,
            contexts,
        }
    }

    pub fn has_noflags(&self) -> bool {
        self.contexts.is_empty() && self.status == TaskStatus::NoStatus
    }
}
impl std::fmt::Display for Task {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let no_context = self
            .contexts
            .iter()
            .fold(self.description.clone(), |desc: String, c: &String| {
                desc.replace(c, "")
            });
        let context_with_color = self
            .contexts
            .iter()
            .fold(no_context, |desc: String, c: &String| {
                format!("{} {}", desc, c.blue())
            });

        Regex::new(r"\s+")
            .unwrap()
            .replace_all(&context_with_color, " ")
            .to_string()
            .fmt(f)
    }
}
