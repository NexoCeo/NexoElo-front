import { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import styles from "./style.module.css";

interface CalendarProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

const meses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function sameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getDate() === dateB.getDate() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getFullYear() === dateB.getFullYear()
  );
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function Calendar({ selectedDate, setSelectedDate }: CalendarProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentYear, currentMonth + offset, 1));
  };

  const days = [];

  for (let index = 0; index < firstDayOfWeek; index += 1) {
    days.push(<span key={`empty-${index}`} className={styles.emptyDay} aria-hidden="true" />);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(currentYear, currentMonth, day);
    const isToday = sameDay(date, today);
    const isSelected = sameDay(date, selectedDate);
    const ariaLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);

    days.push(
      <button
        type="button"
        key={day}
        className={`${styles.day} ${isSelected ? styles.selected : ""} ${isToday ? styles.today : ""}`}
        onClick={() => setSelectedDate(date)}
        aria-label={ariaLabel}
        aria-pressed={isSelected}
      >
        {day}
      </button>,
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          title="Mês anterior"
          aria-label="Mês anterior"
        >
          <FaChevronLeft aria-hidden="true" />
        </button>
        <div className={styles.monthYear} aria-live="polite">
          <span className={styles.month}>{meses[currentMonth]}</span>
          <span className={styles.year}>{currentYear}</span>
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          title="Próximo mês"
          aria-label="Próximo mês"
        >
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {diasSemana.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className={styles.days}>{days}</div>
    </div>
  );
}

export function WeekCalendar({ selectedDate, setSelectedDate }: CalendarProps) {
  const today = new Date();
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = weekDays[6];
  const rangeFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  const changeWeek = (offset: number) => {
    setSelectedDate(addDays(selectedDate, offset * 7));
  };

  return (
    <div className={`${styles.container} ${styles.weekContainer}`}>
      <div className={styles.header}>
        <button
          type="button"
          onClick={() => changeWeek(-1)}
          title="Semana anterior"
          aria-label="Semana anterior"
        >
          <FaChevronLeft aria-hidden="true" />
        </button>
        <div className={styles.monthYear} aria-live="polite">
          <span className={styles.month}>Semana</span>
          <span className={styles.year}>
            {rangeFormatter.format(weekStart)} a {rangeFormatter.format(weekEnd)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => changeWeek(1)}
          title="Próxima semana"
          aria-label="Próxima semana"
        >
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className={styles.weekDays}>
        {weekDays.map((date) => {
          const isSelected = sameDay(date, selectedDate);
          const isCurrentDay = sameDay(date, today);
          const ariaLabel = new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(date);

          return (
            <button
              type="button"
              key={date.toISOString()}
              className={`${styles.weekDay} ${isSelected ? styles.selectedWeekDay : ""} ${isCurrentDay ? styles.currentWeekDay : ""}`}
              onClick={() => setSelectedDate(date)}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
            >
              <span>{diasSemana[date.getDay()]}</span>
              <strong>{date.getDate()}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
