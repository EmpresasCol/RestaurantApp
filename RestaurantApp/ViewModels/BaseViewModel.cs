using System.ComponentModel;
using System.Runtime.CompilerServices;
using RestaurantApp.Helpers;

namespace RestaurantApp.ViewModels
{
    public class BaseViewModel : INotifyPropertyChanged
    {
        private bool _isBusy;
        private string _title = string.Empty;
        private bool _isRefreshing;

        public BaseViewModel()
        {
            // Comando común para volver al inicio
            VolverInicioCommand = new AsyncCommand(async () => await Shell.Current.GoToAsync("//inicio"));
        }

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public string Title
        {
            get => _title;
            set => SetProperty(ref _title, value);
        }

        public bool IsRefreshing
        {
            get => _isRefreshing;
            set => SetProperty(ref _isRefreshing, value);
        }

        // Comando común para todas las vistas
        public AsyncCommand VolverInicioCommand { get; }

        protected bool SetProperty<T>(ref T backingStore, T value,
            [CallerMemberName] string propertyName = "",
            Action onChanged = null)
        {
            if (EqualityComparer<T>.Default.Equals(backingStore, value))
                return false;

            backingStore = value;
            onChanged?.Invoke();
            OnPropertyChanged(propertyName);
            return true;
        }

        #region INotifyPropertyChanged
        public event PropertyChangedEventHandler PropertyChanged;

        protected void OnPropertyChanged([CallerMemberName] string propertyName = "")
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
        #endregion

        // Métodos auxiliares comunes
        protected async Task ExecuteAsync(Func<Task> operation, string loadingMessage = "Cargando...")
        {
            if (IsBusy)
                return;

            try
            {
                IsBusy = true;
                await operation?.Invoke();
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error", ex.Message, "OK");
                System.Diagnostics.Debug.WriteLine($"Error: {ex}");
            }
            finally
            {
                IsBusy = false;
            }
        }

        protected async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, T defaultReturnValue = default(T))
        {
            if (IsBusy)
                return defaultReturnValue;

            try
            {
                IsBusy = true;
                return await operation();
            }
            catch (Exception ex)
            {
                await Application.Current.MainPage.DisplayAlert("Error", ex.Message, "OK");
                System.Diagnostics.Debug.WriteLine($"Error: {ex}");
                return defaultReturnValue;
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}